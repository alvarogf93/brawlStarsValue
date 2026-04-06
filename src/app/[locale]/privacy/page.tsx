import { useTranslations } from 'next-intl'

export default function PrivacyPage() {
  const t = useTranslations('privacy')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="font-['Lilita_One'] text-4xl text-white mb-8">{t('title')}</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6 text-slate-300">
        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('dataCollectedTitle')}</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>{t('dataTag')}</li>
            <li>{t('dataBattles')}</li>
            <li>{t('dataEmail')}</li>
          </ul>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('thirdPartyTitle')}</h2>
          <p>{t('thirdPartyBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('retentionTitle')}</h2>
          <p>{t('retentionBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('gdprTitle')}</h2>
          <p>{t('gdprBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('cookiesTitle')}</h2>
          <p>{t('cookiesBody')}</p>
        </section>

        <section>
          <h2 className="font-['Lilita_One'] text-xl text-white">{t('disclaimerTitle')}</h2>
          <p>{t('disclaimerBody')}</p>
        </section>
      </div>
    </div>
  )
}
