import Image from "next/image";

export default function PresentationNotFound() {
  return (
    <main className="flex min-h-[100svh] items-center justify-center bg-[#0d2d27] px-5 py-10 text-center text-white">
      <div className="w-full max-w-xl rounded-[30px] border border-white/10 bg-white/[0.07] p-8 shadow-2xl backdrop-blur sm:p-12">
        <Image
          src="/heritage-church-logo.png"
          alt="Heritage Church"
          width={512}
          height={288}
          priority
          className="mx-auto h-auto w-full max-w-[240px] mix-blend-screen"
        />
        <h1 className="mt-8 text-3xl font-semibold tracking-[-0.035em]">
          This class display is unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-white/60 sm:text-base">
          Ask the class administrator for the current teacher display link.
        </p>
      </div>
    </main>
  );
}
