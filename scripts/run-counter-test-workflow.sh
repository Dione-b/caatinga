#!/usr/bin/env bash
set -uo pipefail

LOG="/tmp/counter-test-workflow.log"
exec > >(tee "$LOG") 2>&1

echo "=== STEP 1: Remove counter-test if exists ==="
if [ -d /home/dionebastos/Documentos/PROJETOS/counter-test ]; then
  rm -rf /home/dionebastos/Documentos/PROJETOS/counter-test
  echo "REMOVED counter-test"
else
  echo "counter-test did not exist"
fi

echo ""
echo "=== STEP 2: Build and pack packages ==="
cd /home/dionebastos/Documentos/PROJETOS/caatinga
pnpm build
BUILD_EXIT=$?
echo "pnpm build exit code: $BUILD_EXIT"
if [ "$BUILD_EXIT" -ne 0 ]; then exit "$BUILD_EXIT"; fi

pnpm pack:packages
PACK_EXIT=$?
echo "pnpm pack:packages exit code: $PACK_EXIT"
if [ "$PACK_EXIT" -ne 0 ]; then exit "$PACK_EXIT"; fi

echo ""
echo "=== STEP 3: List packed/ ==="
ls -la /home/dionebastos/Documentos/PROJETOS/caatinga/packed/

CORE_TGZ=$(ls /home/dionebastos/Documentos/PROJETOS/caatinga/packed/caatinga-core-*.tgz | head -1)
CLIENT_TGZ=$(ls /home/dionebastos/Documentos/PROJETOS/caatinga/packed/caatinga-client-*.tgz | head -1)
CLI_TGZ=$(ls /home/dionebastos/Documentos/PROJETOS/caatinga/packed/caatinga-cli-*.tgz | head -1)
CORE_NAME=$(basename "$CORE_TGZ")
CLIENT_NAME=$(basename "$CLIENT_TGZ")
CLI_NAME=$(basename "$CLI_TGZ")
echo "CORE_TGZ=$CORE_NAME"
echo "CLIENT_TGZ=$CLIENT_NAME"
echo "CLI_TGZ=$CLI_NAME"

echo ""
echo "=== STEP 4: Scaffold counter-test ==="
cd /home/dionebastos/Documentos/PROJETOS
CAATINGA_TEMPLATES_DIR=/home/dionebastos/Documentos/PROJETOS/caatinga/packages/templates \
  node /home/dionebastos/Documentos/PROJETOS/caatinga/packages/cli/dist/index.js init counter-test --template react-vite-counter
INIT_EXIT=$?
echo "init exit code: $INIT_EXIT"
if [ "$INIT_EXIT" -ne 0 ]; then exit "$INIT_EXIT"; fi

echo ""
echo "=== STEP 5: Patch package.json ==="
PKG_JSON=/home/dionebastos/Documentos/PROJETOS/counter-test/package.json
node -e "
const fs = require('fs');
const path = '$PKG_JSON';
const pkg = JSON.parse(fs.readFileSync(path, 'utf8'));
pkg.dependencies = pkg.dependencies || {};
pkg.devDependencies = pkg.devDependencies || {};
pkg.dependencies['@caatinga/client'] = 'file:../caatinga/packed/$CLIENT_NAME';
pkg.dependencies['@caatinga/core'] = 'file:../caatinga/packed/$CORE_NAME';
pkg.devDependencies['@caatinga/cli'] = 'file:../caatinga/packed/$CLI_NAME';
fs.writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
console.log('Patched package.json:');
console.log(fs.readFileSync(path, 'utf8'));
"

echo ""
echo "=== STEP 6: pnpm install ==="
cd /home/dionebastos/Documentos/PROJETOS/counter-test
pnpm install 2>&1 | tee /tmp/counter-test-install.log
INSTALL_EXIT=${PIPESTATUS[0]}
echo "pnpm install exit code: $INSTALL_EXIT"

echo ""
echo "=== STEP 7: deprecated warnings ==="
grep -i deprecated /tmp/counter-test-install.log || echo "NO_DEPRECATED_WARNINGS"

echo ""
echo "=== STEP 8: contract flow ==="
echo "--- npx caatinga build counter ---"
npx caatinga build counter
BUILD_COUNTER_EXIT=$?
echo "build counter exit code: $BUILD_COUNTER_EXIT"

echo ""
echo "--- npx caatinga deploy counter --network testnet --source alice ---"
npx caatinga deploy counter --network testnet --source alice
DEPLOY_EXIT=$?
echo "deploy exit code: $DEPLOY_EXIT"

GENERATE_EXIT=skipped
if [ "$DEPLOY_EXIT" -eq 0 ]; then
  echo ""
  echo "--- npx caatinga generate counter --network testnet ---"
  npx caatinga generate counter --network testnet
  GENERATE_EXIT=$?
  echo "generate exit code: $GENERATE_EXIT"
  if [ "$GENERATE_EXIT" -eq 0 ]; then
    echo ""
    echo "--- npm run build (vite binding resolve) ---"
    npm run build
    VITE_BUILD_EXIT=$?
    echo "vite build exit code: $VITE_BUILD_EXIT"
  else
    VITE_BUILD_EXIT=skipped
  fi
else
  echo "Skipping generate (deploy failed)"
  VITE_BUILD_EXIT=skipped
fi

echo ""
echo "=== STEP 9: Final structure ==="
ls -la /home/dionebastos/Documentos/PROJETOS/counter-test

echo ""
echo "=== SUMMARY ==="
echo "CORE_TGZ=$CORE_NAME"
echo "CLIENT_TGZ=$CLIENT_NAME"
echo "CLI_TGZ=$CLI_NAME"
echo "INIT_EXIT=$INIT_EXIT"
echo "INSTALL_EXIT=$INSTALL_EXIT"
echo "BUILD_COUNTER_EXIT=$BUILD_COUNTER_EXIT"
echo "DEPLOY_EXIT=$DEPLOY_EXIT"
echo "GENERATE_EXIT=$GENERATE_EXIT"
echo "VITE_BUILD_EXIT=${VITE_BUILD_EXIT:-skipped}"
echo "LOG=$LOG"
