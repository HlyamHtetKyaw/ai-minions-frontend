import { notFound } from 'next/navigation';
import { TOOL_CONFIGS } from '@/lib/tool-config';
import ToolForm from '@/components/ToolForm';
import { getTranslations } from 'next-intl/server';

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

  const tTools = await getTranslations('tools');
  const title = tTools(`${tool}.name` as any);
  const description = tTools(`${tool}.description` as any);
  const translatedFields = config.fields?.map((field) => ({
    ...field,
    label: tTools(`${tool}.fields.${field.name}` as any),
  }));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-muted">{description}</p>
      </div>
      <ToolForm
        toolSlug={config.slug}
        title={title}
        description={description}
        inputType={config.inputType}
        acceptedFileTypes={config.acceptedFileTypes}
        outputType={config.outputType}
        fields={translatedFields}
      />
    </div>
  );
}

export function generateStaticParams() {
  return Object.keys(TOOL_CONFIGS).map((slug) => ({ tool: slug }));
}
