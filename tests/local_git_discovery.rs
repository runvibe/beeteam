use beeteam::repositories::{contracts::ProjectDiscovery, local_git::LocalGitDiscovery};
mod support;
use support::local_git::git;
#[tokio::test]
async fn discovers_only_declared_checkouts_and_linked_worktrees_and_sanitizes_remotes() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("main checkout");
    std::fs::create_dir(&root).unwrap();
    git(&root, &["init", "-b", "main"]);
    git(&root, &["commit", "--allow-empty", "-m", "Fixture"]);
    git(
        &root,
        &[
            "remote",
            "add",
            "origin",
            "https://user:fixture-secret@github.com/acme/app.git?token=fixture-secret#private",
        ],
    );
    let linked = dir.path().join("linked checkout");
    git(
        &root,
        &["worktree", "add", "-b", "review", linked.to_str().unwrap()],
    );
    let unused = dir.path().join("unused checkout");
    git(
        &root,
        &["worktree", "add", "-b", "unused", unused.to_str().unwrap()],
    );
    assert!(linked.join(".git").is_file());
    let nested = root.join("src");
    std::fs::create_dir(&nested).unwrap();
    let inspector = LocalGitDiscovery::default();
    let roots = vec![
        nested.to_string_lossy().to_string(),
        linked.to_string_lossy().to_string(),
    ];
    let found = inspector.discover(&roots).await;
    assert_eq!(found.len(), 2);
    assert_eq!(found[0].status, "detected");
    assert_eq!(found[1].status, "detected");
    assert_eq!(found[0].is_worktree, Some(false));
    assert_eq!(found[1].is_worktree, Some(true));
    assert_eq!(found[0].common_directory, found[1].common_directory);
    assert_ne!(found[0].git_directory, found[1].git_directory);
    assert_eq!(
        found[0].branch.as_ref().unwrap().name.as_deref(),
        Some("main")
    );
    assert_eq!(
        found[1].branch.as_ref().unwrap().name.as_deref(),
        Some("review")
    );
    assert_eq!(
        found[0].remotes[0].url.as_deref(),
        Some("https://github.com/acme/app.git")
    );
    assert!(found[0]
        .checkout_root
        .as_ref()
        .unwrap()
        .ends_with("main checkout"));
    assert!(!serde_json::to_string(&found)
        .unwrap()
        .contains("fixture-secret"));
    git(&linked, &["checkout", "--detach"]);
    let found = inspector
        .discover(&[linked.to_string_lossy().to_string()])
        .await;
    assert_eq!(found[0].branch.as_ref().unwrap().state, "detached");
    assert_eq!(found[0].head_hash.as_ref().unwrap().len(), 40);
}
#[tokio::test]
async fn no_git_missing_directory_unborn_head_and_local_only_remain_distinct() {
    let dir = tempfile::tempdir().unwrap();
    let plain = dir.path().join("plain");
    let local = dir.path().join("local");
    std::fs::create_dir(&plain).unwrap();
    std::fs::create_dir(&local).unwrap();
    git(&local, &["init", "-b", "new-branch"]);
    let roots = [plain.clone(), dir.path().join("missing"), local.clone()]
        .map(|p| p.to_string_lossy().to_string());
    let found = LocalGitDiscovery::default().discover(&roots).await;
    assert_eq!(found[0].status, "not_git");
    assert_eq!(found[0].reason, None);
    assert_eq!(found[1].status, "unavailable");
    assert_eq!(found[1].reason, Some("path_unavailable"));
    assert_eq!(found[2].status, "detected");
    assert!(found[2].remotes.is_empty());
    assert!(found[2].head_hash.is_none());
    assert_eq!(
        found[2].branch.as_ref().unwrap().name.as_deref(),
        Some("new-branch")
    );
}
