import React from "react";

interface RenameModalProps {
  renameValue: string;
  setRenameValue: (val: string) => void;
  onClose: () => void;
  onRename: () => void;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  renameValue,
  setRenameValue,
  onClose,
  onRename,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="neo-box w-full max-w-sm bg-[var(--neo-card-bg)] p-5 space-y-4">
        <h3 className="text-base font-extrabold">Rename File / Folder</h3>
        <input
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="New Name"
          className="w-full neo-input text-xs py-2 px-3 bg-[var(--neo-bg)]"
          autoFocus
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="neo-btn px-3 py-1.5 text-xs font-bold">
            Cancel
          </button>
          <button
            onClick={onRename}
            className="neo-btn px-3 py-1.5 text-xs font-black bg-[var(--neo-primary)] text-[var(--neo-primary-text)]"
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
};
