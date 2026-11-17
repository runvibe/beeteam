use beeteam::repositories::session_dispatch_lease::DispatchLease;
#[test]
fn an_installation_has_one_owner_and_releases_ownership_on_exit() {
    let folder = tempfile::tempdir().unwrap();
    let first = DispatchLease::acquire(folder.path(), "owned-installation").unwrap();
    assert!(DispatchLease::acquire(folder.path(), "owned-installation").is_err());
    assert!(DispatchLease::acquire(folder.path(), "other-installation").is_ok());
    drop(first);
    assert!(DispatchLease::acquire(folder.path(), "owned-installation").is_ok());
}
