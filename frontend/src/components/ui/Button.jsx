export default function Button({
                                   children,
                                   variant = "primary",
                               }) {
    const baseStyles =
        "px-8 py-4 rounded-full font-semibold transition duration-300";

    const variants = {
        primary:
            "bg-white text-black hover:bg-neutral-200",

        secondary:
            "border border-white/40 text-white backdrop-blur-md hover:bg-white hover:text-black",
    };

    return (
        <button className={`${baseStyles} ${variants[variant]}`}>
            {children}
        </button>
    );
}