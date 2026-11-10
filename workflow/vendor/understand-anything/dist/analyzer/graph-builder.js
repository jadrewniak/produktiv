/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80.
 * Frozen reason: duplicate function ids gain a `#startLine` suffix, structural
 * summaries may be the node name, tags may be empty, and call edges are
 * inserted only when the assembler has already resolved the endpoints.
 */
import { LanguageRegistry } from "../languages/language-registry.js";
const KIND_TO_NODE_TYPE = {
    table: "table",
    view: "table",
    index: "table",
    message: "schema",
    type: "schema",
    enum: "schema",
    resource: "resource",
    module: "resource",
    service: "service",
    deployment: "service",
    job: "pipeline",
    stage: "pipeline",
    target: "pipeline",
    route: "endpoint",
    query: "endpoint",
    mutation: "endpoint",
    variable: "config",
    output: "config",
};
export class GraphBuilder {
    nodes = [];
    edges = [];
    languages = new Set();
    nodeIds = new Set();
    edgeKeys = new Set();
    functionIds = new Map();
    projectName;
    gitHash;
    languageRegistry;
    constructor(projectName, gitHash, languageRegistry) {
        this.projectName = projectName;
        this.gitHash = gitHash;
        this.languageRegistry = languageRegistry ?? LanguageRegistry.createDefault();
    }
    detectLanguage(filePath) {
        return this.languageRegistry.getForFile(filePath)?.id ?? "unknown";
    }
    static basename(filePath) {
        return filePath.split("/").pop() ?? filePath;
    }
    functionNodeId(filePath, name, startLine) {
        const base = `function:${filePath}:${name}`;
        const id = this.nodeIds.has(base) ? `${base}#${startLine}` : base;
        if (this.nodeIds.has(id)) {
            console.warn(`[GraphBuilder] Duplicate function ID "${id}" — skipping`);
            return null;
        }
        return id;
    }
    rememberFunction(filePath, name, id) {
        const key = `${filePath}\0${name}`;
        const list = this.functionIds.get(key) ?? [];
        list.push(id);
        this.functionIds.set(key, list);
    }
    /**
     * Resolve a function the assembler already named. Ambiguous names without a
     * start line are dropped instead of attached to the first overload.
     */
    resolveFunctionId(filePath, name, startLine) {
        const base = `function:${filePath}:${name}`;
        if (startLine !== undefined) {
            const suffixed = `${base}#${startLine}`;
            if (this.nodeIds.has(suffixed))
                return suffixed;
            if (this.nodeIds.has(base))
                return base;
            return null;
        }
        const matches = this.functionIds.get(`${filePath}\0${name}`) ?? [];
        if (matches.length === 1)
            return matches[0];
        return null;
    }
    addFile(filePath, meta) {
        const lang = this.detectLanguage(filePath);
        if (lang !== "unknown") {
            this.languages.add(lang);
        }
        const name = GraphBuilder.basename(filePath);
        const id = `file:${filePath}`;
        this.nodeIds.add(id);
        this.nodes.push({
            id,
            type: "file",
            name,
            filePath,
            summary: meta.summary || name,
            tags: meta.tags ?? [],
            complexity: meta.complexity,
        });
    }
    addFileWithAnalysis(filePath, analysis, meta) {
        const lang = this.detectLanguage(filePath);
        if (lang !== "unknown") {
            this.languages.add(lang);
        }
        const fileName = GraphBuilder.basename(filePath);
        const fileId = `file:${filePath}`;
        // Create the file node
        this.nodeIds.add(fileId);
        this.nodes.push({
            id: fileId,
            type: "file",
            name: fileName,
            filePath,
            summary: meta.fileSummary || fileName,
            tags: meta.tags ?? [],
            complexity: meta.complexity,
        });
        // Create function nodes with "contains" edges.
        // Duplicate names in one file are disambiguated with #startLine.
        for (const fn of analysis.functions) {
            const funcId = this.functionNodeId(filePath, fn.name, fn.lineRange[0]);
            if (!funcId)
                continue;
            this.nodeIds.add(funcId);
            this.rememberFunction(filePath, fn.name, funcId);
            this.nodes.push({
                id: funcId,
                type: "function",
                name: fn.name,
                filePath,
                lineRange: fn.lineRange,
                summary: meta.summaries[fn.name] || fn.name,
                tags: [],
                complexity: meta.complexity,
            });
            this.edges.push({
                source: fileId,
                target: funcId,
                type: "contains",
                direction: "forward",
                weight: 1,
            });
        }
        // Create class nodes with "contains" edges
        for (const cls of analysis.classes) {
            const classId = `class:${filePath}:${cls.name}`;
            this.nodeIds.add(classId);
            this.nodes.push({
                id: classId,
                type: "class",
                name: cls.name,
                filePath,
                lineRange: cls.lineRange,
                summary: meta.summaries[cls.name] || cls.name,
                tags: [],
                complexity: meta.complexity,
            });
            this.edges.push({
                source: fileId,
                target: classId,
                type: "contains",
                direction: "forward",
                weight: 1,
            });
        }
    }
    addImportEdge(fromFile, toFile) {
        const key = `imports|file:${fromFile}|file:${toFile}`;
        if (this.edgeKeys.has(key))
            return;
        this.edgeKeys.add(key);
        this.edges.push({
            source: `file:${fromFile}`,
            target: `file:${toFile}`,
            type: "imports",
            direction: "forward",
            weight: 0.7,
        });
    }
    addCallEdge(callerFile, callerFunc, calleeFile, calleeFunc, callerStartLine, calleeStartLine) {
        const source = this.resolveFunctionId(callerFile, callerFunc, callerStartLine);
        const target = this.resolveFunctionId(calleeFile, calleeFunc, calleeStartLine);
        if (!source || !target)
            return;
        const key = `calls|${source}|${target}`;
        if (this.edgeKeys.has(key))
            return;
        this.edgeKeys.add(key);
        this.edges.push({
            source,
            target,
            type: "calls",
            direction: "forward",
            weight: 0.8,
        });
    }
    addNonCodeFile(filePath, meta) {
        const lang = this.detectLanguage(filePath);
        if (lang !== "unknown")
            this.languages.add(lang);
        const name = GraphBuilder.basename(filePath);
        const id = `${meta.nodeType ?? "file"}:${filePath}`;
        this.nodeIds.add(id);
        this.nodes.push({
            id,
            type: meta.nodeType,
            name,
            filePath,
            summary: meta.summary || name,
            tags: meta.tags ?? [],
            complexity: meta.complexity,
        });
        return id;
    }
    addNonCodeFileWithAnalysis(filePath, meta) {
        const fileId = this.addNonCodeFile(filePath, meta);
        // Create child nodes for definitions (tables, schemas, etc.)
        for (const def of meta.definitions ?? []) {
            this.addChildNode({
                id: `${def.kind}:${filePath}:${def.name}`,
                type: this.mapKindToNodeType(def.kind),
                name: def.name,
                filePath,
                lineRange: def.lineRange,
                summary: `${def.kind}: ${def.name} (${def.fields.length} fields)`,
                tags: [],
                complexity: meta.complexity,
            }, fileId);
        }
        // Create child nodes for services
        for (const svc of meta.services ?? []) {
            this.addChildNode({
                id: `service:${filePath}:${svc.name}`,
                type: "service",
                name: svc.name,
                filePath,
                summary: `Service ${svc.name}${svc.image ? ` (image: ${svc.image})` : ""}`,
                tags: [],
                complexity: meta.complexity,
            }, fileId);
        }
        // Create child nodes for endpoints
        for (const ep of meta.endpoints ?? []) {
            const name = `${ep.method ?? ""} ${ep.path}`.trim();
            this.addChildNode({
                id: `endpoint:${filePath}:${ep.path}`,
                type: "endpoint",
                name,
                filePath,
                lineRange: ep.lineRange,
                summary: `Endpoint: ${name}`,
                tags: [],
                complexity: meta.complexity,
            }, fileId);
        }
        // Create child nodes for steps (pipeline/makefile targets)
        for (const step of meta.steps ?? []) {
            this.addChildNode({
                id: `step:${filePath}:${step.name}`,
                type: "pipeline",
                name: step.name,
                filePath,
                lineRange: step.lineRange,
                summary: `Step: ${step.name}`,
                tags: [],
                complexity: meta.complexity,
            }, fileId);
        }
        // Create child nodes for resources (Terraform, etc.)
        for (const res of meta.resources ?? []) {
            this.addChildNode({
                id: `resource:${filePath}:${res.name}`,
                type: "resource",
                name: res.name,
                filePath,
                lineRange: res.lineRange,
                summary: `Resource: ${res.name} (${res.kind})`,
                tags: [],
                complexity: meta.complexity,
            }, fileId);
        }
    }
    addChildNode(node, parentId) {
        if (this.nodeIds.has(node.id)) {
            console.warn(`[GraphBuilder] Duplicate node ID "${node.id}" — skipping`);
            return;
        }
        this.nodeIds.add(node.id);
        this.nodes.push(node);
        this.edges.push({ source: parentId, target: node.id, type: "contains", direction: "forward", weight: 1 });
    }
    mapKindToNodeType(kind) {
        const mapped = KIND_TO_NODE_TYPE[kind];
        if (!mapped) {
            console.warn(`[GraphBuilder] Unknown definition kind "${kind}" — falling back to "concept" node type`);
        }
        return mapped ?? "concept";
    }
    build() {
        return {
            version: "1.0.0",
            project: {
                name: this.projectName,
                languages: [...this.languages].sort((a, b) => a.localeCompare(b)),
                frameworks: [],
                description: "",
                analyzedAt: new Date().toISOString(),
                gitCommitHash: this.gitHash,
            },
            nodes: [...this.nodes],
            edges: [...this.edges],
            layers: [],
            tour: [],
        };
    }
}
//# sourceMappingURL=graph-builder.js.map