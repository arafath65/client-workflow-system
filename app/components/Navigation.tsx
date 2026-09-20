import Link from "next/link";

type NavigationProps = {
  currentPage: string;
};

const navigation = [
  { label: "Dashboard", href: "/dashboard", key: "dashboard" },
  { label: "Clients", href: "/clients", key: "clients" },
  { label: "Files", href: "/files", key: "files" },
  { label: "Workflows", href: "/workflows", key: "workflows" },
  { label: "Staff", href: "/staff", key: "staff" },
  { label: "Staff Work", href: "/staff-work", key: "staff-work" },
  { label: "Third Parties", href: "/third-parties", key: "third-parties" },
  { label: "Calendar", href: "/calendar", key: "calendar" },
  { label: "Finance", href: "/payments", key: "finance" },
  { label: "Audit Logs", href: "/audit-logs", key: "audit-logs" },
  { label: "Settings", href: "/settings", key: "settings" },
];

export default function Navigation({ currentPage }: NavigationProps) {
  return (
    <nav className="border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-1 overflow-x-auto px-6">
        {navigation.map((item) => {
          const active = currentPage === item.key;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-xs transition ${
                active
                  ? "border-[#f9a800] font-semibold text-black"
                  : "border-transparent font-medium text-black/45 hover:border-[#f9a800]/50 hover:text-black"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
