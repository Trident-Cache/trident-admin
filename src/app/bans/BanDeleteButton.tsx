'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { apiUrl } from '@/lib/format';

export function BanDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDelete = async () => {
    setLoading(true);
    setConfirm(false);
    try {
      await fetch(apiUrl(`/api/bans/${id}`), { method: 'DELETE' });
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button className="btn-danger btn-sm" disabled={loading} onClick={() => setConfirm(true)}>
        {loading ? '...' : 'Delete'}
      </button>
      <ConfirmDialog
        open={confirm}
        title="Delete Ban"
        message="Are you sure you want to delete this ban rule?"
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirm(false)}
      />
    </>
  );
}
