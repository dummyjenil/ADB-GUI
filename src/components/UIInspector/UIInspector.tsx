import React, { useState, useMemo } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { Layers, RefreshCw, Search, Copy, Check, Code, ChevronRight, ChevronDown, AlertCircle } from "lucide-react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";
import { Input } from "../ui/Input";

interface UiDumpResult {
  success: boolean;
  screenshot_path: string;
  data_url?: string;
  xml_content: string;
  error?: string;
}

interface ParsedNode {
  id: string;
  tag: string;
  className: string;
  resourceId: string;
  text: string;
  contentDesc: string;
  packageName: string;
  boundsStr: string;
  bounds: { x1: number; y1: number; x2: number; y2: number; width: number; height: number } | null;
  clickable: boolean;
  enabled: boolean;
  children: ParsedNode[];
  attributes: Record<string, string>;
}

interface UIInspectorProps {
  activeDevice: string | null;
}

export const UIInspector: React.FC<UIInspectorProps> = ({ activeDevice }) => {
  const [loading, setLoading] = useState(false);
  const [dumpData, setDumpData] = useState<UiDumpResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<ParsedNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<ParsedNode | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Record<string, boolean>>({});

  const handleDumpUI = async () => {
    if (!activeDevice) return;
    setLoading(true);
    setErrorMsg(null);
    setSelectedNode(null);
    setHoveredNode(null);

    try {
      const res: UiDumpResult = await invoke("dump_ui_hierarchy", { serial: activeDevice });
      if (res.success) {
        setDumpData(res);
      } else {
        setErrorMsg(res.error || "Failed to dump UI hierarchy");
      }
    } catch (err: any) {
      setErrorMsg(String(err));
    } finally {
      setLoading(false);
    }
  };

  // Parse raw XML string to DOM Node Tree
  const parsedRoot = useMemo(() => {
    if (!dumpData || !dumpData.xml_content) return null;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(dumpData.xml_content, "text/xml");
      const hierarchyNode = doc.querySelector("hierarchy");
      if (!hierarchyNode) return null;

      let counter = 0;
      const parseXmlNode = (el: Element): ParsedNode => {
        counter++;
        const nodeId = `node_${counter}`;
        const attrs: Record<string, string> = {};
        for (let i = 0; i < el.attributes.length; i++) {
          const attr = el.attributes[i];
          attrs[attr.name] = attr.value;
        }

        const boundsStr = attrs["bounds"] || "";
        let bounds = null;
        if (boundsStr) {
          // Format "[x1,y1][x2,y2]"
          const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
          if (match) {
            const x1 = parseInt(match[1], 10);
            const y1 = parseInt(match[2], 10);
            const x2 = parseInt(match[3], 10);
            const y2 = parseInt(match[4], 10);
            bounds = { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
          }
        }

        const className = attrs["class"] || el.tagName;
        const shortClass = className.split(".").pop() || className;

        const children: ParsedNode[] = Array.from(el.children).map((child) => parseXmlNode(child));

        return {
          id: nodeId,
          tag: el.tagName,
          className: shortClass,
          resourceId: attrs["resource-id"] || "",
          text: attrs["text"] || "",
          contentDesc: attrs["content-desc"] || "",
          packageName: attrs["package"] || "",
          boundsStr,
          bounds,
          clickable: attrs["clickable"] === "true",
          enabled: attrs["enabled"] === "true",
          children,
          attributes: attrs,
        };
      };

      const firstChild = hierarchyNode.firstElementChild;
      return firstChild ? parseXmlNode(firstChild) : null;
    } catch (err) {
      console.error("Failed to parse XML:", err);
      return null;
    }
  }, [dumpData]);

  const toggleExpand = (id: string) => {
    setExpandedNodeIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleExpandAll = () => {
    if (!parsedRoot) return;
    const allIds: Record<string, boolean> = {};
    const traverse = (n: ParsedNode) => {
      allIds[n.id] = true;
      n.children.forEach(traverse);
    };
    traverse(parsedRoot);
    setExpandedNodeIds(allIds);
  };

  const handleCollapseAll = () => {
    setExpandedNodeIds({});
  };

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!activeDevice) {
    return (
      <Card headerTitle="UIAutomator Screen Inspector" headerIcon={<Layers className="h-5 w-5" />} headerVariant="accent">
        <div className="text-center py-12 text-[var(--neo-text-muted)] font-bold">
          No device selected. Please select a connected Android device from top navigation bar.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Control */}
      <Card
        headerTitle="UIAutomator Screen Inspector"
        headerIcon={<Layers className="h-5 w-5" />}
        headerVariant="accent"
        headerAction={
          <Button
            onClick={handleDumpUI}
            loading={loading}
            variant="primary"
            size="sm"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
          >
            Dump Present Screen
          </Button>
        }
      >
        <p className="text-xs text-[var(--neo-text-muted)] font-medium mb-4">
          Dump active screen layout hierarchy via Android <code className="font-mono text-[var(--neo-primary)]">uiautomator dump</code>. Inspect elements, view properties, and copy resource IDs/xpaths.
        </p>

        {errorMsg && (
          <div className="neo-box p-3 mb-4 bg-red-500/20 text-red-300 border-red-500 flex items-center justify-between text-xs font-bold">
            <span className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg}
            </span>
            <button onClick={() => setErrorMsg(null)} className="text-xs hover:underline opacity-80 cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {!dumpData ? (
          <div className="neo-box bg-[var(--neo-card-bg)] p-12 text-center">
            <Layers className="h-12 w-12 mx-auto mb-3 text-[var(--neo-primary)] animate-pulse" />
            <h3 className="text-sm font-extrabold uppercase mb-1">No Screen Hierarchy Dumped Yet</h3>
            <p className="text-xs text-[var(--neo-text-muted)] max-w-sm mx-auto mb-4">
              Click "Dump Present Screen" to capture device screenshot and fetch raw XML element tree.
            </p>
            <Button onClick={handleDumpUI} loading={loading} variant="primary" size="md" icon={<RefreshCw className="h-4 w-4" />}>
              Dump Present Screen
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* LEFT: SCREEN CANVAS OVERLAY (4 COLS) */}
            <div className="lg:col-span-4 neo-box bg-[var(--neo-card-bg)] p-3 flex flex-col items-center">
              <div className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)] mb-2 self-start flex items-center justify-between w-full">
                <span>Screen Visualizer</span>
                <Badge variant="secondary">Live Snapshot</Badge>
              </div>

              {dumpData.data_url || dumpData.screenshot_path ? (
                <div className="relative border-2 border-black rounded overflow-hidden max-h-[500px] inline-block bg-black">
                  <img
                    src={dumpData.data_url || convertFileSrc(dumpData.screenshot_path)}
                    alt="Device Screen"
                    className="max-h-[500px] w-auto object-contain block"
                  />
                  {/* Bounding box highlight overlay */}
                  {(selectedNode?.bounds || hoveredNode?.bounds) && (
                    <div
                      className={`absolute pointer-events-none border-2 transition-all ${
                        selectedNode?.bounds ? "border-emerald-400 bg-emerald-500/30" : "border-cyan-400 bg-cyan-500/20"
                      }`}
                      style={{
                        top: `${((hoveredNode?.bounds || selectedNode?.bounds)!.y1 / 2560) * 100}%`,
                        left: `${((hoveredNode?.bounds || selectedNode?.bounds)!.x1 / 1440) * 100}%`,
                        width: `${(((hoveredNode?.bounds || selectedNode?.bounds)!.width) / 1440) * 100}%`,
                        height: `${(((hoveredNode?.bounds || selectedNode?.bounds)!.height) / 2560) * 100}%`,
                      }}
                    />
                  )}
                </div>
              ) : (
                <div className="py-20 text-xs text-[var(--neo-text-muted)] font-bold">Screenshot unavailable</div>
              )}
            </div>

            {/* MIDDLE: XML NODE TREE (5 COLS) */}
            <div className="lg:col-span-5 neo-box bg-[var(--neo-card-bg)] p-3 flex flex-col h-[560px]">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)]">
                  UI Hierarchy Tree
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleExpandAll}
                    className="px-2 py-0.5 text-[10px] font-bold neo-box-sm bg-black/20 hover:bg-black/30 text-[var(--neo-text)] cursor-pointer"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={handleCollapseAll}
                    className="px-2 py-0.5 text-[10px] font-bold neo-box-sm bg-black/20 hover:bg-black/30 text-[var(--neo-text)] cursor-pointer"
                  >
                    Collapse
                  </button>
                </div>
              </div>

              <div className="mb-2">
                <Input
                  placeholder="Filter by ID, text, class..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  icon={<Search className="h-3.5 w-3.5" />}
                  className="py-1 text-xs"
                />
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar neo-box bg-black/30 p-2 font-mono text-[11px] space-y-1">
                {parsedRoot ? (
                  <TreeNodeItem
                    node={parsedRoot}
                    selectedNode={selectedNode}
                    hoveredNode={hoveredNode}
                    onSelectNode={setSelectedNode}
                    onHoverNode={setHoveredNode}
                    searchTerm={searchTerm.toLowerCase()}
                    expandedNodeIds={expandedNodeIds}
                    toggleExpand={toggleExpand}
                  />
                ) : (
                  <div className="p-4 text-center text-xs text-slate-400">Failed to render node tree</div>
                )}
              </div>
            </div>

            {/* RIGHT: NODE PROPERTIES & COPIER (3 COLS) */}
            <div className="lg:col-span-3 neo-box bg-[var(--neo-card-bg)] p-3 flex flex-col justify-between h-[560px] overflow-y-auto custom-scrollbar">
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-[var(--neo-text-muted)] mb-3 pb-1 border-b border-black/20">
                  Element Inspector
                </div>

                {selectedNode ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="text-[10px] font-extrabold text-[var(--neo-text-muted)] uppercase block">Class</span>
                      <span className="font-mono font-bold text-[var(--neo-primary)] break-all">{selectedNode.className}</span>
                    </div>

                    {selectedNode.resourceId && (
                      <div>
                        <span className="text-[10px] font-extrabold text-[var(--neo-text-muted)] uppercase block">Resource ID</span>
                        <div className="flex items-center justify-between bg-black/30 p-1.5 rounded font-mono break-all text-[11px]">
                          <span>{selectedNode.resourceId}</span>
                          <button
                            onClick={() => handleCopy(selectedNode.resourceId, "res_id")}
                            className="p-1 hover:bg-white/10 rounded shrink-0 ml-1 cursor-pointer"
                            title="Copy Resource ID"
                          >
                            {copiedKey === "res_id" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedNode.text && (
                      <div>
                        <span className="text-[10px] font-extrabold text-[var(--neo-text-muted)] uppercase block">Text</span>
                        <div className="flex items-center justify-between bg-black/30 p-1.5 rounded font-mono break-all text-[11px]">
                          <span>"{selectedNode.text}"</span>
                          <button
                            onClick={() => handleCopy(selectedNode.text, "text")}
                            className="p-1 hover:bg-white/10 rounded shrink-0 ml-1 cursor-pointer"
                            title="Copy Text"
                          >
                            {copiedKey === "text" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedNode.boundsStr && (
                      <div>
                        <span className="text-[10px] font-extrabold text-[var(--neo-text-muted)] uppercase block">Bounds</span>
                        <span className="font-mono text-cyan-400 text-[11px] block">{selectedNode.boundsStr}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-black/20 space-y-1">
                      <span className="text-[10px] font-extrabold text-[var(--neo-text-muted)] uppercase block mb-1">
                        Flags & Attributes
                      </span>
                      <div className="grid grid-cols-2 gap-1 text-[10px]">
                        <Badge variant={selectedNode.clickable ? "secondary" : "warning"}>
                          {selectedNode.clickable ? "Clickable" : "Not Clickable"}
                        </Badge>
                        <Badge variant={selectedNode.enabled ? "primary" : "warning"}>
                          {selectedNode.enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-xs text-[var(--neo-text-muted)] font-bold">
                    Select an element from the XML tree to inspect properties
                  </div>
                )}
              </div>

              {selectedNode && (
                <div className="pt-3 border-t border-black/20 space-y-2">
                  <Button
                    onClick={() => handleCopy(`//${selectedNode.className}[@resource-id="${selectedNode.resourceId}"]`, "xpath")}
                    variant="ghost"
                    size="sm"
                    className="w-full text-[11px]"
                    icon={copiedKey === "xpath" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Code className="h-3.5 w-3.5" />}
                  >
                    {copiedKey === "xpath" ? "XPath Copied!" : "Copy Estimated XPath"}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

interface TreeNodeItemProps {
  node: ParsedNode;
  selectedNode: ParsedNode | null;
  hoveredNode: ParsedNode | null;
  onSelectNode: (node: ParsedNode) => void;
  onHoverNode: (node: ParsedNode | null) => void;
  searchTerm: string;
  expandedNodeIds: Record<string, boolean>;
  toggleExpand: (id: string) => void;
}

const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  selectedNode,
  hoveredNode,
  onSelectNode,
  onHoverNode,
  searchTerm,
  expandedNodeIds,
  toggleExpand,
}) => {
  const isExpanded = expandedNodeIds[node.id] ?? true;
  const isSelected = selectedNode?.id === node.id;
  const isHovered = hoveredNode?.id === node.id;

  const matchesSearch =
    searchTerm &&
    (node.className.toLowerCase().includes(searchTerm) ||
      node.resourceId.toLowerCase().includes(searchTerm) ||
      node.text.toLowerCase().includes(searchTerm));

  const hasChildren = node.children.length > 0;

  return (
    <div className="pl-2">
      <div
        onClick={(e) => {
          e.stopPropagation();
          onSelectNode(node);
        }}
        onMouseEnter={() => onHoverNode(node)}
        onMouseLeave={() => onHoverNode(null)}
        className={`flex items-center gap-1.5 py-1 px-1.5 rounded cursor-pointer transition-colors ${
          isSelected
            ? "bg-[var(--neo-primary)] text-[var(--neo-primary-text)] font-bold shadow-sm"
            : isHovered
            ? "bg-white/10"
            : matchesSearch
            ? "bg-amber-500/30 text-amber-200"
            : "hover:bg-white/5 text-slate-300"
        }`}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(node.id);
            }}
            className="p-0.5 hover:bg-black/20 rounded cursor-pointer"
          >
            {isExpanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
          </button>
        ) : (
          <span className="w-4 inline-block" />
        )}

        <span className={`font-bold shrink-0 text-[11px] ${isSelected ? "text-black" : "text-cyan-400"}`}>
          {node.className}
        </span>

        {node.resourceId && (
          <span className={`text-[10px] px-1 rounded truncate max-w-[130px] font-mono ${
            isSelected ? "bg-black/20 text-black font-semibold" : "text-emerald-300 bg-black/40"
          }`}>
            #{node.resourceId.split("/").pop()}
          </span>
        )}

        {node.text && (
          <span className={`text-[10px] italic truncate max-w-[110px] ${
            isSelected ? "text-zinc-900 font-semibold" : "text-amber-200"
          }`}>
            "{node.text}"
          </span>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="border-l-2 border-white/10 ml-2 pl-1 space-y-0.5">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              selectedNode={selectedNode}
              hoveredNode={hoveredNode}
              onSelectNode={onSelectNode}
              onHoverNode={onHoverNode}
              searchTerm={searchTerm}
              expandedNodeIds={expandedNodeIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
};
