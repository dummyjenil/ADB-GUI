import React from "react";
import { Modal, Input, Button } from "../ui";
import { Edit2 } from "lucide-react";

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
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Rename File / Folder"
      icon={<Edit2 className="h-4 w-4" />}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={onRename} disabled={!renameValue.trim()}>
            Rename
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (renameValue.trim()) onRename();
        }}
        className="space-y-3"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="New Name"
          autoFocus
          required
        />
      </form>
    </Modal>
  );
};
