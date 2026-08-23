import Button from "../components/ui/Button";

export default function NotFound() {
    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-24 text-center">
            <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                404
            </p>

            <h1 className="text-4xl md:text-6xl font-black uppercase leading-none mb-6">
                Page Not Found
            </h1>

            <p className="text-neutral-600 max-w-xl mx-auto mb-10">
                The page you&apos;re looking for doesn&apos;t exist or has
                been moved.
            </p>

            <Button variant="outline" to="/">
                Back to Home
            </Button>
        </section>
    );
}
