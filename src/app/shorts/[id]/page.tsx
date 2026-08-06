import { redirect } from 'next/navigation';

// Диплинк на конкретный тренёк (ссылки из «Поделиться», главной, профиля
// тренера). Раньше здесь жила отдельная 380-строчная лента со своей модалкой
// комментариев — вторая реализация фида с расходящимся UX. Теперь единая
// лента /shorts (Instagram-шит описания/комментариев, тапбар) открывает нужный
// тренёк по ?id=; скоуп тренера пробрасывается через ?trainerId=.
export default async function ShortDeepLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ trainerId?: string }>;
}) {
  const { id } = await params;
  const { trainerId } = await searchParams;
  const query = trainerId
    ? `id=${encodeURIComponent(id)}&trainerId=${encodeURIComponent(trainerId)}`
    : `id=${encodeURIComponent(id)}`;
  redirect(`/shorts?${query}`);
}
