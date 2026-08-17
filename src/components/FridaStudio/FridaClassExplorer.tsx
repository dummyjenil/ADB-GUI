import React, { useState } from "react";
import { Code2, Sparkles, Sliders, Layers } from "lucide-react";
import { Button, Card } from "../ui";

interface FridaClassExplorerProps {
  onInsertCode: (code: string) => void;
  selectedTarget: string | null;
}

export const FridaClassExplorer: React.FC<FridaClassExplorerProps> = ({
  onInsertCode,
  selectedTarget,
}) => {
  const [targetClass, setTargetClass] = useState("com.example.app.MainActivity");
  const [targetMethod, setTargetMethod] = useState("checkUserSubscription");
  const [logArgs, setLogArgs] = useState(true);
  const [logReturn, setLogReturn] = useState(true);
  const [printStack, setPrintStack] = useState(false);
  const [overrideReturn, setOverrideReturn] = useState(true);
  const [overrideValue, setOverrideValue] = useState("true");
  const [returnType, setReturnType] = useState<"boolean" | "string" | "integer" | "void">("boolean");

  // Dynamic Frida hook generator
  const generatedHookCode = `/* Auto-generated Frida Hook for ${targetClass}.${targetMethod} */
Java.perform(function () {
    try {
        var targetClass = Java.use("${targetClass || 'com.example.app.MyClass'}");
        var methodName = "${targetMethod || 'myMethod'}";

        // Hook all method overloads
        var overloads = targetClass[methodName].overloads;
        console.log("[*] Found " + overloads.length + " overloads for " + methodName);

        for (var i = 0; i < overloads.length; i++) {
            overloads[i].implementation = function () {
                var args = arguments;
                ${logArgs ? `console.log("\\n[⚡ HOOK INVOKED] ${targetClass}.${targetMethod}()");
                for (var j = 0; j < args.length; j++) {
                    console.log("  ↳ Arg[" + j + "]: " + args[j]);
                }` : ''}
                ${printStack ? `console.log("  ↳ Stack Trace:\\n" + Java.use("android.util.Log").getStackTraceString(Java.use("java.lang.Exception").$new()));` : ''}

                var result = this[methodName].apply(this, arguments);
                ${logReturn ? `console.log("  ↳ Original Return: " + result);` : ''}

                ${overrideReturn ? `// Override return value
                var newResult = ${returnType === "boolean"
        ? overrideValue.toLowerCase() === "true"
          ? "true"
          : "false"
        : returnType === "string"
          ? `"${overrideValue}"`
          : returnType === "integer"
            ? `${parseInt(overrideValue, 10) || 0}`
            : "result"
      };
                console.log("  ↳ Modified Return -> " + newResult);
                return newResult;` : 'return result;'}
            };
        }
        console.log("[✓] Hook attached to ${targetClass}.${targetMethod}");
    } catch (e) {
        console.error("[-] Hooking error for ${targetClass}: " + e);
    }
});`;

  const handleSendToEditor = () => {
    onInsertCode(generatedHookCode);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-violet-400" />
            Java Class & Method Hook Generator
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Generate bulletproof Frida hooks for any Android Java class, method, or overload in seconds.
          </p>
        </div>

        {selectedTarget && (
          <div className="text-xs font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded neo-box border">
            Target: <strong>{selectedTarget}</strong>
          </div>
        )}
      </div>

      {/* Interactive Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <div className="lg:col-span-5 space-y-4">
          <Card headerTitle="Target Class & Method Definition" headerIcon={<Sliders className="h-4 w-4" />}>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--neo-text-muted)] mb-1">
                  Full Java Class Name
                </label>
                <input
                  type="text"
                  value={targetClass}
                  onChange={(e) => setTargetClass(e.target.value)}
                  placeholder="e.g. com.target.security.Licensing"
                  className="neo-input w-full font-mono text-xs p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--neo-text-muted)] mb-1">
                  Target Method Name
                </label>
                <input
                  type="text"
                  value={targetMethod}
                  onChange={(e) => setTargetMethod(e.target.value)}
                  placeholder="e.g. isPremiumUser"
                  className="neo-input w-full font-mono text-xs p-2"
                />
              </div>

              <div className="pt-2 border-t border-black/10 space-y-2">
                <div className="text-[10px] font-bold uppercase text-[var(--neo-text-muted)]">
                  Inspection Options
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={logArgs}
                    onChange={(e) => setLogArgs(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span>Log Input Parameters (Arguments)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={logReturn}
                    onChange={(e) => setLogReturn(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span>Log Original Return Value</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={printStack}
                    onChange={(e) => setPrintStack(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span>Print Call Stack Trace</span>
                </label>
              </div>

              <div className="pt-2 border-t border-black/10 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer font-bold select-none text-purple-400">
                  <input
                    type="checkbox"
                    checked={overrideReturn}
                    onChange={(e) => setOverrideReturn(e.target.checked)}
                    className="accent-purple-500"
                  />
                  <span>Modify / Override Return Value</span>
                </label>

                {overrideReturn && (
                  <div className="pl-5 space-y-2">
                    <div className="flex gap-2">
                      <select
                        value={returnType}
                        onChange={(e: any) => setReturnType(e.target.value)}
                        className="neo-input text-xs py-1 px-2 font-mono"
                      >
                        <option value="boolean">Boolean</option>
                        <option value="string">String</option>
                        <option value="integer">Integer</option>
                      </select>

                      <input
                        type="text"
                        value={overrideValue}
                        onChange={(e) => setOverrideValue(e.target.value)}
                        placeholder="Custom value"
                        className="neo-input text-xs font-mono py-1 px-2 flex-1"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Code Preview & Injection Area */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            headerTitle="Generated Hook Script"
            headerIcon={<Code2 className="h-4 w-4 text-purple-400" />}
            headerAction={
              <Button
                size="sm"
                variant="primary"
                onClick={handleSendToEditor}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                Send to Script Studio
              </Button>
            }
          >
            <div className="space-y-3">
              <pre className="p-3 bg-black/40 text-emerald-300 font-mono text-xs rounded neo-box max-h-[380px] overflow-y-auto custom-scrollbar leading-relaxed">
                {generatedHookCode}
              </pre>
              <div className="flex justify-between items-center text-[10px] text-[var(--neo-text-muted)] font-mono">
                <span>Hook handles all overloads automatically</span>
                <span>Ready to inject</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
