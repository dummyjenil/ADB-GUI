import React from "react";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
}

export const Table: React.FC<TableProps> = ({ children, className = "", ...props }) => (
  <div className="w-full overflow-x-auto custom-scrollbar neo-box-sm border-2 border-[var(--neo-border)]">
    <table className={`w-full text-left font-mono text-xs border-collapse ${className}`} {...props}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <thead
    className={`bg-[var(--neo-bg)] border-b-2 border-[var(--neo-border)] uppercase tracking-wider text-[11px] font-black text-[var(--neo-text-muted)] sticky top-0 z-10 ${className}`}
    {...props}
  >
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <tbody className={`divide-y divide-[var(--neo-border)]/20 ${className}`} {...props}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  interactive?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  selected = false,
  interactive = true,
  className = "",
  ...props
}) => (
  <tr
    className={`transition-colors ${
      selected
        ? "bg-[var(--neo-primary)]/15 font-bold"
        : interactive
        ? "hover:bg-black/10"
        : ""
    } ${className}`}
    {...props}
  >
    {children}
  </tr>
);

export const TableHead: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <th className={`p-3 font-black text-left whitespace-nowrap ${className}`} {...props}>
    {children}
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = "",
  ...props
}) => (
  <td className={`p-3 align-middle ${className}`} {...props}>
    {children}
  </td>
);
