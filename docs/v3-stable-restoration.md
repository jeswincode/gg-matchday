# v3 stable restoration notes

The `restore-main-to-previous-stable` branch restores the application source to the production v3 baseline at `4cd537e9865c5ec8c56c1e626d80fac12041764b`.

The single World-rollout commit was reverted. The dependency lockfile received security-only updates for vulnerable transitive packages; application features and data models from the stable baseline were not changed by those dependency updates.

The newer World implementation remains preserved on `backup/main-before-restore-20261105`.

No MongoDB migration, record deletion, or collection rename is part of this restoration.
