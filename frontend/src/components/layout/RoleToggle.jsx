import useFinanceStore from "../../store/useFinanceStore";
import CustomSelect from "../ui/CustomSelect.jsx";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];

export default function RoleToggle() {
  const role = useFinanceStore((s) => s.role);
  const setRole = useFinanceStore((s) => s.setRole);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 hidden sm:inline">Role:</span>
      <div className="w-28">
        <CustomSelect value={role} onChange={setRole} options={ROLE_OPTIONS} />
      </div>
    </div>
  );
}
