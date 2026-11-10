# Diagram cost eval

windows: not claimed

Measured on the vendored adapter at workflow/vendor/archify. validate_ms is validate_ir. render_ms is render_ir, including the artifact checker. html_bytes and svg_bytes are the written HTML file. peak_rss_bytes is the highest RSS sampled from the measurement process and its renderer child. resource_max_rss is process.resourceUsage().maxRSS for that measurement process. The 20-node chain is a fail-closed layout diagnostic and has no cost row. Each Node section below is one passing suite run.

vendor_root: workflow/vendor/archify

## Node v20.20.2

node: v20.20.2
node_binary: ~/.nvm/versions/node/v20.20.2/bin/node
exit: 0
vendor_bytes: 1828492

### architecture
nodes: 3
validate_ms: 84
render_ms: 295
html_bytes: 786447
svg_bytes: 7469
peak_rss_bytes: 56377344
peak_rss_mib: 53.8
resource_max_rss: 48864
resource_max_rss_unit: kilobytes

### workflow
nodes: 3
validate_ms: 99
render_ms: 120
html_bytes: 786033
svg_bytes: 7047
peak_rss_bytes: 60964864
peak_rss_mib: 58.1
resource_max_rss: 48912
resource_max_rss_unit: kilobytes

### sequence
nodes: 4
validate_ms: 58
render_ms: 102
html_bytes: 788090
svg_bytes: 9108
peak_rss_bytes: 50626560
peak_rss_mib: 48.3
resource_max_rss: 48352
resource_max_rss_unit: kilobytes

### dataflow
nodes: 4
validate_ms: 78
render_ms: 102
html_bytes: 787971
svg_bytes: 8989
peak_rss_bytes: 60637184
peak_rss_mib: 57.8
resource_max_rss: 48272
resource_max_rss_unit: kilobytes

### lifecycle
nodes: 4
validate_ms: 58
render_ms: 100
html_bytes: 788637
svg_bytes: 9643
peak_rss_bytes: 67272704
peak_rss_mib: 64.2
resource_max_rss: 48384
resource_max_rss_unit: kilobytes

### architecture-12
nodes: 12
validate_ms: 75
render_ms: 102
html_bytes: 798403
svg_bytes: 19411
peak_rss_bytes: 61079552
peak_rss_mib: 58.3
resource_max_rss: 48320
resource_max_rss_unit: kilobytes

## Node v22.23.2

node: v22.23.2
node_binary: ~/.nvm/versions/node/v22.23.2/bin/node
exit: 0
vendor_bytes: 1828492

### architecture
nodes: 3
validate_ms: 54
render_ms: 83
html_bytes: 786447
svg_bytes: 7469
peak_rss_bytes: 75087872
peak_rss_mib: 71.6
resource_max_rss: 54864
resource_max_rss_unit: kilobytes

### workflow
nodes: 3
validate_ms: 72
render_ms: 93
html_bytes: 786033
svg_bytes: 7047
peak_rss_bytes: 74153984
peak_rss_mib: 70.7
resource_max_rss: 54992
resource_max_rss_unit: kilobytes

### sequence
nodes: 4
validate_ms: 53
render_ms: 80
html_bytes: 788090
svg_bytes: 9108
peak_rss_bytes: 53411840
peak_rss_mib: 50.9
resource_max_rss: 54832
resource_max_rss_unit: kilobytes

### dataflow
nodes: 4
validate_ms: 53
render_ms: 82
html_bytes: 787971
svg_bytes: 8989
peak_rss_bytes: 53477376
peak_rss_mib: 51.0
resource_max_rss: 54896
resource_max_rss_unit: kilobytes

### lifecycle
nodes: 4
validate_ms: 53
render_ms: 84
html_bytes: 788637
svg_bytes: 9643
peak_rss_bytes: 53313536
peak_rss_mib: 50.8
resource_max_rss: 54704
resource_max_rss_unit: kilobytes

### architecture-12
nodes: 12
validate_ms: 54
render_ms: 82
html_bytes: 798403
svg_bytes: 19411
peak_rss_bytes: 75530240
peak_rss_mib: 72.0
resource_max_rss: 54880
resource_max_rss_unit: kilobytes
