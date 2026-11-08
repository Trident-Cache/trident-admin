import { PageHead } from '@/components/ui/primitives';
import { CoverageForm } from './CoverageForm';

export const dynamic = 'force-dynamic';

export default function CacheCoveragePage() {
  return (
    <>
      <PageHead
        title="Cache Coverage"
        sub="Paste a set of URLs to see which are currently cached and the overall cached percentage — useful to verify a warm run landed."
      />
      <CoverageForm />
    </>
  );
}
