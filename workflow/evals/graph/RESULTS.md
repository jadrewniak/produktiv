# Medium graph benchmark

ceiling: first recorded run
ceiling_wall_time_ms: 26590
ceiling_peak_rss_bytes: 248135680
windows: not claimed

Measured from the prebuilt bundle at workflow/vendor/understand-anything/dist using production node_modules already on disk. pnpm was not invoked. This is not the user installer.

## Node

node: v22.23.2
node_binary: ~/.nvm/versions/node/v22.23.2/bin/node
launch_node: v20.20.2
launch_graph_available: false
launch_graph_reason: node-floor
simulated_node: v20.20.2
simulated_graph_available: false
simulated_graph_reason: node-floor
web_tree_sitter: loaded
wasm: node_modules/.pnpm/tree-sitter-typescript@0.23.2/node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm

launch_node is the binary that started this file. When that major is below 22, launch_graph_available false is the floor check on that real binary, and this process does not load web-tree-sitter. simulated_* is a probe with major 20, so the floor check does not install Node 20. The measured build is the node version in this section, which is >= 22, and that process loads web-tree-sitter. A host with no Node binary does not learn graph availability by running this probe. That case is the host contract in workflow/references/capabilities.md.

## Build

corpus: .upstream/understand-anything
head: 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80
status: PARTIAL
partial: 20/487 files have no parser (.astro 10, no-ext 4, .css 2, .wasm 2, .html 1, .ps1 1); 0/310 grammar files failed to parse
wall_time_ms: 26590
peak_rss_bytes: 248135680
peak_rss_mib: 236.6
rss_sample_bytes: 244695040
resource_max_rss: 238976
resource_max_rss_unit: kilobytes
file_count: 487
committed_files: 515
node_count: 1370
edge_count: 2117
cache_bytes: 4211406
graph_bytes: 1763222
bundle_bytes: 361302639
model_calls: 0
pnpm: not invoked

file_count is meta.analyzedFiles, the files that entered the structural scan. wall_time_ms and peak_rss_bytes are the first recorded run. cache_bytes is .workflow/graph plus any remaining .workflow/cache. graph_bytes is .workflow/graph alone. bundle_bytes is the installed production tree (dist, scripts, and production dependencies).

find_symbol and callers report PARTIAL when the graph is PARTIAL. That status is the graph's, including when the symbol itself was found.

## Weight

bundle_weight: not stopped
installed_bytes: 361302639
runtime_bytes: 37477417
resolved_wasm_bytes: 28977384
web_tree_sitter_wasm_bytes: 201535
web_tree_sitter_js_bytes: 165707
js_library_bytes: 6941015
dist_bytes: 992838
script_bytes: 198938
package_wasm_bytes: 30761440
native_prebuild_bytes: 156561864
other_package_bytes: 172787559

runtime_bytes is what a distribution needs: the WASM files the loader resolves, web-tree-sitter's JS and WASM, ignore/yaml/zod, dist, and the extract scripts. native_prebuild_bytes are Node-API binaries inside the grammar npm packages. other_package_bytes are grammar sources, bindings, and the rest of those packages. The structural path does not load either of those. The bundle weight check stays not stopped because the loaded payload is the runtime set.

The installed graph image is 31294693 bytes. The source `vendor/understand-anything` tree on the same machine, including the dev install, is 413453931 bytes. Native prebuilds are not in the image. The bundle weight check passes for the install model.

## Neighborhood

symbol: function:scripts/generate-large-graph.mjs:pick
name: pick
file: scripts/generate-large-graph.mjs
lines: 44-46
find_symbol: PARTIAL
callers: generateEdges, generateNodes, injectTier2Edge, injectTier2Node, applyMessy
callers_status: PARTIAL
