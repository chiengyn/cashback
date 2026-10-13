'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireAdmin } from '@/lib/require-admin';
import { markWithdrawalPaid, rejectWithdrawal } from '@/services/wallet';

const Id = z.string().uuid();

export async function markPaidAction(formData: FormData) {
  await requireAdmin();
  await markWithdrawalPaid(Id.parse(formData.get('id')));
  revalidatePath('/admin/withdrawals');
}

export async function rejectAction(formData: FormData) {
  await requireAdmin();
  const note = String(formData.get('note') ?? '').slice(0, 500);
  await rejectWithdrawal(Id.parse(formData.get('id')), note);
  revalidatePath('/admin/withdrawals');
}
