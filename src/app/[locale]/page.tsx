import { useTranslations } from 'next-intl'
import { InputForm } from '@/components/landing/InputForm'

export default function LandingPage() {
  const t = useTranslations('landing')

  return (
    <div className="flex flex-col min-h-screen">
      <main className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Abstract Background with Blue/Purple Glows */}
        <div className="absolute top-1/4 left-1/4 w-[30vw] h-[30vw] bg-[var(--color-brawl-blue)] rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-[pulse_8s_ease-in-out_infinite]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] bg-[var(--color-brawl-purple)] rounded-full mix-blend-screen filter blur-[200px] opacity-20"></div>

        <div className="text-center glass p-10 rounded-[32px] max-w-[500px] w-full animate-fade-in relative z-10 shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/5">
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[var(--color-brawl-blue)] to-[var(--color-brawl-purple)] flex items-center justify-center p-[2px] shadow-[0_0_30px_rgba(59,130,246,0.3)]">
              <div className="w-full h-full bg-[var(--color-brawl-dark)] rounded-full flex items-center justify-center">
                <span className="text-3xl">💎</span>
              </div>
            </div>
          </div>
          
          <h1 className="text-[2.5rem] leading-[1.1] font-bold font-['Righteous'] mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
            {t('title')}
          </h1>
          <p className="mt-2 text-slate-400 font-['Inter'] mb-8 text-base">
            {t('subtitle')}
          </p>
          
          <InputForm />
        </div>
      </main>
    </div>
  )
}
