# Bee Team Desktop

Desktop candidates include the standalone server from the same build. On first use, open Bee Team Desktop. It looks for the embedded panel and MCP on 127.0.0.1 using APP_PORT (59865 by default). A compatible, running instance is reused. If the port is free, Desktop starts its private server. A conflicting service or incompatible release produces a recovery message. Close the conflicting application yourself or configure a free APP_PORT and restart Desktop.

Closing the window normally hides it. Choose **Open Bee Team** in the tray to return, or **Quit** to close Desktop and its own child server. The **Desktop** menu controls the close behavior and launching hidden at login. Browser and MCP clients using a separately launched server continue after Quit. Desktop uses the server's database configuration; uninstalling the desktop package should preserve the database. Upgrade using the same installation channel after backing up your data.

## PortuguÃªs

O instalador Desktop inclui o servidor da mesma versÃ£o. Ao abrir o Bee Team Desktop, ele reutiliza o painel e o MCP locais compatÃ­veis ou inicia o servidor incluÃ­do se a porta estiver livre. A porta padrÃ£o Ã© 59865 e pode ser configurada com APP_PORT. Uma porta ocupada por serviÃ§o incompatÃ­vel exige intervenÃ§Ã£o antes de tentar novamente.

Fechar a janela normalmente mantÃ©m o aplicativo na bandeja. **Open Bee Team** reabre a janela. **Quit** encerra o desktop e o servidor iniciado por ele. O menu **Desktop** permite escolher o comportamento ao fechar e o inÃ­cio oculto no login. O navegador e o MCP continuam disponÃ­veis quando o servidor foi iniciado separadamente. Atualize pelo mesmo canal de instalaÃ§Ã£o e faÃ§a backup dos dados antes de atualizar.

## Candidate builds

Run `node scripts/build-distribution.mjs` at the repository root, then `python scripts/stage-desktop.py` with Python 3.11 or later. From the desktop directory, run `npx --yes @tauri-apps/cli@2.11.2 build` with the platform bundle type (nsis, dmg or deb). Build separately for each native target. CI installs or mounts the candidate and checks the packaged server against an isolated SQLite database. The workflow uploads review artifacts; public distribution requires signing, macOS notarization, checksums and channel acceptance.

## Preparing package channels

Use the final signed and notarized DMG or signed NSIS executable as the input to `python scripts/desktop-channel-metadata.py <asset> --version X.Y.Z --arch arm64 --output <new-directory>` (use `x64` for Intel/x64). Keep the input filename when publishing the immutable release asset. Verify the downloaded checksum and architecture before submitting the generated cask to a tap or validating the WinGet manifest with `winget validate`. A generated manifest represents a single architecture.

On an Ubuntu packaging host with apt-utils and GnuPG, run `bash scripts/desktop-apt-repository.sh <package.deb> <new-directory> <signing-key-fingerprint>`. Verify the staged InRelease signature, then test installation from an isolated APT client with a pinned signed-by keyring. Hosting the signed repository, publishing a tap and submitting a WinGet manifest are separate release operations.
