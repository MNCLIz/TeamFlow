import { useEffect, useRef } from "react";
import { toast } from "sonner";

export function EditableTitle({
  id,
  value,
  onChange,
  readOnly,
  updateName,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  updateName: (params: {
    id: string;
    name?: string;
    description?: string;
  }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSavedRef = useRef(value);

  const save = async () => {
    const trimmed = inputRef.current?.value.trim() ?? "";
    if (trimmed === lastSavedRef.current) return;
    if (!trimmed) {
      if (inputRef.current) inputRef.current.value = lastSavedRef.current;
      return;
    }
    try {
      await updateName({ id: id, name: trimmed });
      lastSavedRef.current = trimmed;
      onChange(trimmed);
    } catch (err) {
      toast.error("项目名称更新失败", { position: "top-center" });
      console.log(err);
      if (inputRef.current) inputRef.current.value = lastSavedRef.current;
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => save();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      save();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (readOnly) {
    return <h1 className="text-3xl font-bold tracking-tight">{value}</h1>;
  }

  return (
    <input
      ref={inputRef}
      defaultValue={value}
      onBlur={save}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
      className="text-3xl font-bold tracking-tight bg-transparent border-none outline-none focus:ring-0 rounded px-1 -ml-1 w-full"
    />
  );
}
