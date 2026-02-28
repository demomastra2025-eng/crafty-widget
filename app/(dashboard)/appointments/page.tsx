import { Metadata } from 'next';

import { generateMeta } from '@/lib/generate-meta';

import AppointmentsPageClient from './appointments-page-client';

export async function generateMetadata(): Promise<Metadata> {
  return generateMeta({
    title: 'Запись к сотрудникам',
    description: 'Календарь записи по сотрудникам: день, неделя, месяц, отпуска, перерывы и праздники.',
    canonical: '/appointments',
  });
}

export default function Page() {
  return <AppointmentsPageClient />;
}
