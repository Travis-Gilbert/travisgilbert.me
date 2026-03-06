import { fetchVideoProject } from '@/lib/studio-api';
import VideoEditor from '@/components/studio/VideoEditor';

export default async function VideoEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const video = await fetchVideoProject(slug);

  if (!video) {
    return <div>Video project not found</div>;
  }

  return (
    <VideoEditor
      slug={slug}
      video={video}
    />
  );
}
