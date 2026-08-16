import React from "react";
import { Modal, Input, Button } from "../ui";
import { FolderPlus } from "lucide-react";

interface CreateFolderModalProps {
  folderName: string;
  setFolderName: (name: string) => void;
  onClose: () => void;
  onCreate: () => void;
}

export const CreateFolderModal: React.FC<CreateFolderModalProps> = ({
  folderName,
  setFolderName,
  onClose,
  onCreate,
}) => {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Create New Folder"
      icon={<FolderPlus className="h-4 w-4" />}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={onCreate} disabled={!folderName.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (folderName.trim()) onCreate();
        }}
        className="space-y-3"
      >
        <Input
          value={folderName}
          onChange={(e) => setFolderName(e.target.value)}
          placeholder="Folder Name"
          autoFocus
          required
        />
      </form>
    </Modal>
  );
};
