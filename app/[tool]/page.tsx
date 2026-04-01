import { notFound } from 'next/navigation';
import { TOOL_CONFIGS } from '@/lib/tool-config';
import ToolForm from '@/components/ToolForm';

export default async function ToolPage({
  params,
}: {
  params: Promise<{ tool: string }>;
}) {
  const { tool } = await params;
  const config = TOOL_CONFIGS[tool];

  if (!config) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
        <p className="mt-2 text-muted">{config.description}</p>
      </div>
      <ToolForm
        toolSlug={config.slug}
        title={config.title}
        description={config.description}
        inputType={config.inputType}
        acceptedFileTypes={config.acceptedFileTypes}
        outputType={config.outputType}
        fields={config.fields}
      />
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(TOOL_CONFIGS).map((slug) => ({ tool: slug }));
}
