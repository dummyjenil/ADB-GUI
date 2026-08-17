import React, { useState } from "react";
import { Cpu, Sparkles, Code2 } from "lucide-react";
import { Button, Card } from "../ui";

interface FridaMemoryInspectorProps {
  onInsertCode: (code: string) => void;
  selectedTarget: string | null;
}

export const FridaMemoryInspector: React.FC<FridaMemoryInspectorProps> = ({
  onInsertCode,
  selectedTarget,
}) => {
  const [moduleName, setModuleName] = useState("libnative-lib.so");
  const [symbolName, setSymbolName] = useState("Java_com_example_app_NativeSecurity_verifyLicense");
  const [logArgs, setLogArgs] = useState(true);
  const [logReturn, setLogReturn] = useState(true);
  const [overrideReturn, setOverrideReturn] = useState(true);
  const [overridePtr, setOverridePtr] = useState("0x1");

  const nativeHookCode = `/* Native Function Interceptor for ${moduleName}!${symbolName} */
function hookNative() {
    var targetModule = "${moduleName}";
    var targetSymbol = "${symbolName}";

    var targetAddress = Module.findExportByName(targetModule, targetSymbol);
    if (targetAddress === null) {
        console.log("[-] Export " + targetSymbol + " not found in " + targetModule);
        // Try fallback to find in any module
        targetAddress = Module.findExportByName(null, targetSymbol);
    }

    if (targetAddress !== null) {
        console.log("[+] Target found at address: " + targetAddress);
        Interceptor.attach(targetAddress, {
            onEnter: function (args) {
                console.log("\\n[⚡ NATIVE ENTER] " + targetSymbol);
                ${logArgs ? `console.log("  ↳ Arg[0] (JNIEnv*): " + args[0]);
                console.log("  ↳ Arg[1] (jobject): " + args[1]);
                console.log("  ↳ Arg[2]: " + args[2]);` : ''}
            },
            onLeave: function (retval) {
                ${logReturn ? `console.log("  ↳ Original Native Return: " + retval);` : ''}
                ${overrideReturn ? `// Override native return value
                retval.replace(ptr("${overridePtr}"));
                console.log("  ↳ Replaced Native Return with: " + ptr("${overridePtr}"));` : ''}
            }
        });
        console.log("[✓] Native Interceptor attached successfully!");
    } else {
        console.log("[-] Could not locate address for " + targetSymbol);
    }
}

setImmediate(hookNative);`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Cpu className="h-6 w-6 text-cyan-400" />
            Native Modules & Symbol Interceptor
          </h2>
          <p className="text-xs text-[var(--neo-text-muted)] font-mono mt-1">
            Intercept C/C++ native functions, JNI exports, and shared libraries (.so) with Frida Interceptor.
          </p>
        </div>

        {selectedTarget && (
          <div className="text-xs font-mono bg-purple-500/10 text-purple-400 px-3 py-1.5 rounded neo-box border">
            Target: <strong>{selectedTarget}</strong>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Module Settings */}
        <div className="lg:col-span-5 space-y-4">
          <Card headerTitle="Native Target Configuration" headerIcon={<Cpu className="h-4 w-4 text-cyan-400" />}>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--neo-text-muted)] mb-1">
                  Shared Object (.so) Library
                </label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. libnative-lib.so or libc.so"
                  className="neo-input w-full font-mono text-xs p-2"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-[var(--neo-text-muted)] mb-1">
                  Exported Symbol / Function Name
                </label>
                <input
                  type="text"
                  value={symbolName}
                  onChange={(e) => setSymbolName(e.target.value)}
                  placeholder="e.g. open, strcmp, Java_..."
                  className="neo-input w-full font-mono text-xs p-2"
                />
              </div>

              <div className="pt-2 border-t border-black/10 space-y-2">
                <div className="text-[10px] font-bold uppercase text-[var(--neo-text-muted)]">
                  Native Interception Options
                </div>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={logArgs}
                    onChange={(e) => setLogArgs(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Log Native Arguments (Pointers)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none">
                  <input
                    type="checkbox"
                    checked={logReturn}
                    onChange={(e) => setLogReturn(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Log Original Retval</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer font-bold select-none text-cyan-400">
                  <input
                    type="checkbox"
                    checked={overrideReturn}
                    onChange={(e) => setOverrideReturn(e.target.checked)}
                    className="accent-cyan-500"
                  />
                  <span>Override Retval (ptr replace)</span>
                </label>

                {overrideReturn && (
                  <div className="pl-5">
                    <input
                      type="text"
                      value={overridePtr}
                      onChange={(e) => setOverridePtr(e.target.value)}
                      placeholder="Hex Pointer e.g. 0x1 or 0x0"
                      className="neo-input text-xs font-mono py-1 px-2 w-full"
                    />
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Generated Native Script */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            headerTitle="Generated Native Interceptor"
            headerIcon={<Code2 className="h-4 w-4 text-cyan-400" />}
            headerAction={
              <Button
                size="sm"
                variant="primary"
                onClick={() => onInsertCode(nativeHookCode)}
                icon={<Sparkles className="h-3.5 w-3.5" />}
              >
                Send to Script Studio
              </Button>
            }
          >
            <div className="space-y-3">
              <pre className="p-3 bg-black/40 text-cyan-300 font-mono text-xs rounded neo-box max-h-[380px] overflow-y-auto custom-scrollbar leading-relaxed">
                {nativeHookCode}
              </pre>
              <div className="flex justify-between items-center text-[10px] text-[var(--neo-text-muted)] font-mono">
                <span>Direct C/C++ Memory Interceptor</span>
                <span>Fast Inline Hook</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
