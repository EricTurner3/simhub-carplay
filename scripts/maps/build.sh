#!/usr/bin/env bash
# Builds ATS/ETS2 map tiles and routing data with truckermudgeon/maps.
# Runs inside WSL (tippecanoe has no Windows build). Everything is installed
# per-user under ~/.local; no sudo needed.
#
#   wsl bash scripts/maps/build.sh [ats|ets2|all]     (or: npm run maps:build)
#
# Env overrides: ATS_DIR, ETS2_DIR (game install dirs), FORCE=1 (rebuild all).
# Output: data/maps/ in this repo (gitignored; derived from your game files).
set -euo pipefail

GAMES="${1:-ats}"
REPO="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$REPO/data/maps"
WORK="$HOME/.cache/simhub-carplay"
MAPS="$WORK/maps"
PARSED="$WORK/parser"
GEN="$WORK/out"
NODE_VERSION=24.22.3
ATS_DIR="${ATS_DIR:-/mnt/d/SteamLibrary/steamapps/common/American Truck Simulator}"
ETS2_DIR="${ETS2_DIR:-/mnt/d/SteamLibrary/steamapps/common/Euro Truck Simulator 2}"

log() { printf '\n\033[36m== %s\033[0m\n' "$*"; }
# Skip a step when its output exists (unless FORCE=1).
need() { [[ "${FORCE:-0}" == 1 || ! -e "$1" ]]; }

mkdir -p "$WORK" "$OUT" "$HOME/.local/bin"
export PATH="$HOME/.local/opt/node/bin:$HOME/.local/bin:$PATH"

# --- toolchain --------------------------------------------------------------
if ! node -v 2>/dev/null | grep -q "^v${NODE_VERSION}$"; then
  log "Installing Node $NODE_VERSION to ~/.local/opt/node"
  rm -rf "$HOME/.local/opt/node" && mkdir -p "$HOME/.local/opt/node"
  curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz" \
    | tar -xJ --strip-components=1 -C "$HOME/.local/opt/node"
fi

if ! command -v tippecanoe >/dev/null; then
  log "Building tippecanoe"
  # SQLite headers without root: unpack the -dev package locally.
  SQL="$WORK/sqlite-dev"
  if [[ ! -e "$SQL/usr/include/sqlite3.h" ]]; then
    mkdir -p "$SQL" && (cd "$SQL" && apt-get download libsqlite3-dev && dpkg -x libsqlite3-dev_*.deb .)
  fi
  [[ -d "$WORK/tippecanoe" ]] || git clone --depth 1 https://github.com/felt/tippecanoe.git "$WORK/tippecanoe"
  # Via the environment: the Makefile appends to these with :=, which
  # command-line variables would override.
  CFLAGS="-I$SQL/usr/include" CXXFLAGS="-I$SQL/usr/include" LDFLAGS="-L$SQL/usr/lib/x86_64-linux-gnu" \
    make -C "$WORK/tippecanoe" -j"$(nproc)"
  cp "$WORK/tippecanoe"/{tippecanoe,tile-join} "$HOME/.local/bin/"
fi

# --- truckermudgeon/maps checkout (Linux-native, pinned to our submodule) ---
REV="$(git -C "$REPO/vendor/maps" rev-parse HEAD)"
if [[ ! -d "$MAPS/.git" ]]; then
  log "Cloning truckermudgeon/maps"
  git clone https://github.com/truckermudgeon/maps.git "$MAPS"
fi
if [[ "$(git -C "$MAPS" rev-parse HEAD)" != "$REV" || ! -e "$MAPS/node_modules" ]]; then
  log "Checking out $REV and installing"
  git -C "$MAPS" fetch -q origin && git -C "$MAPS" checkout -q "$REV"
  git -C "$MAPS" submodule update --init --recursive
  (cd "$MAPS" && npm ci && npm run build -w packages/clis/parser)
fi
cd "$MAPS"
RES=packages/clis/generator/resources

# --- per game ----------------------------------------------------------------
build_game() { # $1 = ats|ets2
  local game=$1 map dir
  if [[ $game == ats ]]; then map=usa dir=$ATS_DIR; else map=europe dir=$ETS2_DIR; fi
  [[ -e "$dir/base.scs" ]] || { echo "Game files not found: $dir (set ${game^^}_DIR)"; exit 1; }

  if need "$PARSED/$map-nodes.json"; then
    log "[$game] Parsing game files (a few minutes)"
    npx parser -i "$dir" -o "$PARSED"
  fi
  if need "$GEN/$game.pmtiles"; then
    log "[$game] Map tiles"
    npx generator map -h -m "$map" -i "$PARSED" -o "$GEN" --dataOverridesPath "$RES/trucksim-overrides.json"
  fi
  if need "$GEN/$game-footprints.pmtiles"; then
    log "[$game] Building footprints"
    npx generator footprints -m "$map" -i "$PARSED" -o "$GEN"
  fi
  if need "$GEN/$map-graph.json"; then
    log "[$game] Routing graph"
    npx generator graph -m "$map" -i "$PARSED" -o "$GEN" -c
  fi
  if [[ $game == ets2 ]] && need "$GEN/europe-roundabouts.json"; then
    log "[ets2] Roundabouts"
    npx generator roundabouts -m europe -i "$PARSED" -g "$GEN" -o "$GEN" -c
  fi

  log "[$game] Copying to data/maps"
  cp "$GEN/$game.pmtiles" "$GEN/$game-footprints.pmtiles" "$OUT/"
  mkdir -p "$OUT/$map"
  # Routing inputs read by the bridge (FileSource looks files up by basename).
  cp "$PARSED/$map-"*.json "$GEN/$map-graph.json" "$OUT/$map/"
  [[ $game == ets2 ]] && cp "$GEN/europe-roundabouts.json" "$OUT/$map/"
  return 0
}

case "$GAMES" in
  ats) build_game ats ;;
  ets2) build_game ets2 ;;
  all) build_game ats; build_game ets2 ;;
  *) echo "usage: build.sh [ats|ets2|all]"; exit 1 ;;
esac

# --- shared --------------------------------------------------------------------
if need "$GEN/world.pmtiles"; then
  log "World base layer"
  tippecanoe -Z4 -z8 -y name -b 10 -X -f -o "$GEN/world.pmtiles" \
    "$RES/water.geojson" "$RES/countries.geojson" "$RES/states.geojson"
fi
if need "$GEN/sprites.json"; then
  log "Spritesheet"
  maps=(); [[ -e "$PARSED/usa-nodes.json" ]] && maps+=(-m usa); [[ -e "$PARSED/europe-nodes.json" ]] && maps+=(-m europe)
  npx generator spritesheet "${maps[@]}" -i "$PARSED" -o "$GEN"
fi
cp "$GEN/world.pmtiles" "$GEN"/sprites{,@2x}.{png,json} "$OUT/"

log "Done"
du -sh "$OUT"/* | sed 's/^/  /'
