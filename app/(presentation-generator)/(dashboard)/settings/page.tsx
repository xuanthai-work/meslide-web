import SettingPage from './SettingPage'
import { translate } from '@/i18n/translate'

export const metadata = {
  title: translate('settings.metadata.title'),
  description: translate('settings.metadata.description'),
}
const page = async () => {
  return <SettingPage />
}

export default page
