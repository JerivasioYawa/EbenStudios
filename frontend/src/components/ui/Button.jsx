import { Link } from "react-router-dom";

export default function Button({
                                   children,
                                   variant = "primary",
                                   to,
                                   ...props
                               }) {
    const baseStyles =
        "inline-block px-8 py-4 rounded-full font-semibold transition duration-300";

    const variants = {
        primary:
            "bg-white text-black hover:bg-neutral-200",

        secondary:
            "border border-white/40 text-white backdrop-blur-md hover:bg-white hover:text-black",

        outline:
            "border border-black/20 text-black hover:bg-black hover:text-white",
    };

    const className = `${baseStyles} ${variants[variant]}`;

    if (to) {
        return (
            <Link to={to} className={className} {...props}>
                {children}
            </Link>
        );
    }

    return (
        <button className={className} {...props}>
            {children}
        </button>
    );
}