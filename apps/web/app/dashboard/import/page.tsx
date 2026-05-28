import ImportWizard from './components/ImportWizard'

export default function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>
}) {
  return <ImportWizard searchParamsPromise={searchParams} />
}
