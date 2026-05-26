import { ShowroomHome } from "@/components/showroom/ShowroomHome";
import { loadShowroomSnapshot } from "@/lib/showroom-data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Page(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const snapshot = await loadShowroomSnapshot(searchParams ?? {});

  return <ShowroomHome snapshot={snapshot} />;
}
