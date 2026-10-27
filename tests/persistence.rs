use beeteam::db::{init_pool, run_migrations};
use sqlx::Row;
use testcontainers::{
    core::{IntoContainerPort, WaitFor},
    runners::AsyncRunner,
    GenericImage, ImageExt,
};

#[tokio::test]
async fn schema_enforces_v7_and_soft_deletion() {
    let container = if std::env::var("BEE_TEST_DATABASE_URL").is_ok() {
        None
    } else {
        Some(
            GenericImage::new("postgres", "18")
                .with_exposed_port(5432.tcp())
                .with_wait_for(WaitFor::message_on_stderr(
                    "database system is ready to accept connections",
                ))
                .with_env_var("POSTGRES_PASSWORD", "test")
                .start()
                .await
                .unwrap(),
        )
    };
    let url = if let Some(container) = &container {
        let port = container.get_host_port_ipv4(5432).await.unwrap();
        format!("postgres://postgres:test@127.0.0.1:{port}/postgres")
    } else {
        std::env::var("BEE_TEST_DATABASE_URL").unwrap()
    };
    let pool = init_pool(&url).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let row = sqlx::query(
        r#"INSERT INTO agents (data) VALUES ('{"name":"test"}') RETURNING id, deleted_at"#,
    )
    .fetch_one(&pool)
    .await
    .unwrap();
    let id: uuid::Uuid = row.get("id");
    assert_eq!(id.get_version_num(), 7);
    assert!(sqlx::query("DELETE FROM agents WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .is_err());
    assert!(sqlx::query(
        "INSERT INTO agents(id,data) VALUES ('10000000-0000-4000-8000-000000000001','{}')"
    )
    .execute(&pool)
    .await
    .is_err());
    for invalid in [
        "00000000-0000-0000-0000-000000000001",
        "10000000-0000-7000-0000-000000000001",
    ] {
        let mut tx = pool.begin().await.unwrap();
        let accepted = sqlx::query("INSERT INTO agents(id,data) VALUES($1,'{}')")
            .bind(uuid::Uuid::parse_str(invalid).unwrap())
            .execute(&mut *tx)
            .await
            .is_ok();
        tx.rollback().await.unwrap();
        assert!(
            !accepted,
            "Invalid UUID variant passed database CHECK: {invalid}"
        );
    }
    sqlx::query("UPDATE agents SET deleted_at=now() WHERE id=$1")
        .bind(id)
        .execute(&pool)
        .await
        .unwrap();
    assert_eq!(
        sqlx::query_scalar::<_, i64>("SELECT count(*) FROM agents WHERE id=$1")
            .bind(id)
            .fetch_one(&pool)
            .await
            .unwrap(),
        1
    );
}
