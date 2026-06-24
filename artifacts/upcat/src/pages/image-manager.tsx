import { Layout } from "@/components/layout";
import ImageManager from "@/components/ImageManager";

export default function ImageManagerPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto w-full py-8 space-y-6">
        <h1 className="text-3xl font-bold">Image Manager</h1>
        <p className="text-muted-foreground">
          Upload images or download them from the web. These images can be used in quiz questions.
          Use the relative path shown below in your quiz JSON&apos;s{" "}
          <code className="bg-muted px-1 rounded">imageUrl</code> field.
        </p>
        <ImageManager />
      </div>
    </Layout>
  );
}
