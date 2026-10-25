export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="border-b bg-card px-6 py-5">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function PageSkeleton({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <div className="p-6">
        <div className="rounded-md border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
          Em construção.
        </div>
      </div>
    </div>
  );
}
