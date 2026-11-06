#!/usr/bin/env bash
# Stage an immutable APT repository locally with an explicitly selected signing key.
set -euo pipefail
if [[ $# != 3 || ! -f $1 || -e $2 || ! $3 =~ ^([A-Fa-f0-9]{40}|[A-Fa-f0-9]{64})$ ]]; then
  echo "Usage: desktop-apt-repository.sh candidate.deb NEW_DIRECTORY SIGNING_FINGERPRINT" >&2
  exit 2
fi
deb=$(realpath "$1")
output=$(realpath -m "$2")
fingerprint=$3
arch=$(dpkg-deb -f "$deb" Architecture)
case "$arch" in amd64|arm64) ;; *) echo "Unsupported package architecture" >&2; exit 2;; esac
mkdir "$output"
cd "$output"
index="dists/stable/main/binary-$arch"
mkdir -p pool/main "$index"
cp "$deb" pool/main/
apt-ftparchive packages pool > "$index/Packages"
gzip -nc "$index/Packages" > "$index/Packages.gz"
apt-ftparchive -o APT::FTPArchive::Release::Suite=stable \
  -o APT::FTPArchive::Release::Codename=stable \
  -o "APT::FTPArchive::Release::Architectures=$arch" \
  -o APT::FTPArchive::Release::Components=main release dists/stable > Release.tmp
mv Release.tmp dists/stable/Release
gpg --batch --local-user "$fingerprint" --clearsign -o dists/stable/InRelease dists/stable/Release
gpg --batch --local-user "$fingerprint" --armor --detach-sign -o dists/stable/Release.gpg dists/stable/Release
gpg --batch --export "$fingerprint" > beeteam-desktop-archive-keyring.gpg
gpgv --keyring "$output/beeteam-desktop-archive-keyring.gpg" dists/stable/InRelease
