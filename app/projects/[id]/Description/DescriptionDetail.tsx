export function DescriptionDetail({
  description = "",
}: {
  description: string;
}) {
  return (
    <>
      <div className="w-full h-full">
        <div className="w-24 shrink-0 text-ml text-muted-foreground pt-0.5">
          description
        </div>
        <div>{description}</div>
      </div>
    </>
  );
}
