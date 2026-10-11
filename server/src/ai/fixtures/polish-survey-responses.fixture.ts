export type PolishSurveyTopic =
  | 'cena'
  | 'obsluga_klienta'
  | 'dostawa'
  | 'jakosc_produktu';

export interface PolishSurveyAnswer {
  id: string;
  topic: PolishSurveyTopic;
  text: string;
}

/**
 * Synthetic Polish open-text survey answers with clear topic labels.
 * Used to compare English MiniLM vs multilingual E5 clustering quality.
 */
export const POLISH_SURVEY_ANSWERS: PolishSurveyAnswer[] = [
  // cena
  { id: 'cena-01', topic: 'cena', text: 'Ceny są zdecydowanie za wysokie w stosunku do tego, co dostaję.' },
  { id: 'cena-02', topic: 'cena', text: 'Produkt jest drogi, a promocje prawie nic nie obniżają.' },
  { id: 'cena-03', topic: 'cena', text: 'Nie podoba mi się stały wzrost opłat przy kasie.' },
  { id: 'cena-04', topic: 'cena', text: 'Za taką kwotę mogę kupić tańszy odpowiednik w innym sklepie.' },
  { id: 'cena-05', topic: 'cena', text: 'Abonament miesięczny jest zbyt kosztowny dla zwykłego klienta.' },
  { id: 'cena-06', topic: 'cena', text: 'Brakuje tańszych wariantów, wszystko jest w premium cenie.' },
  { id: 'cena-07', topic: 'cena', text: 'Rabaty są symboliczne, realna cena nadal odstrasza.' },
  { id: 'cena-08', topic: 'cena', text: 'Koszt przesyłki plus cena produktu dają zbyt duży rachunek.' },
  { id: 'cena-09', topic: 'cena', text: 'Uważam, że stosunek ceny do wartości jest słaby.' },
  { id: 'cena-10', topic: 'cena', text: 'Szkoda pieniędzy, bo to samo dostanę taniej u konkurencji.' },
  { id: 'cena-11', topic: 'cena', text: 'Cennik jest nieprzejrzysty i nagle pojawiają się dopłaty.' },
  { id: 'cena-12', topic: 'cena', text: 'Za tę cenę oczekiwałabym dużo więcej w zestawie.' },

  // obsługa klienta
  { id: 'obs-01', topic: 'obsluga_klienta', text: 'Konsultant na czacie był nieuprzejmy i nie chciał pomóc.' },
  { id: 'obs-02', topic: 'obsluga_klienta', text: 'Infolinia jest niedostępna, nikt nie odbiera telefonu.' },
  { id: 'obs-03', topic: 'obsluga_klienta', text: 'Pani z obsługi szybko rozwiązała mój problem, bardzo miła.' },
  { id: 'obs-04', topic: 'obsluga_klienta', text: 'Czekałem trzy dni na odpowiedź mailową od supportu.' },
  { id: 'obs-05', topic: 'obsluga_klienta', text: 'Reklamację odrzucono bez wyjaśnienia, brak kontaktu z doradcą.' },
  { id: 'obs-06', topic: 'obsluga_klienta', text: 'Pracownik w salonie był kompetentny i cierpliwie wszystko wytłumaczył.' },
  { id: 'obs-07', topic: 'obsluga_klienta', text: 'Bot odpowiada ogólnikami, a do człowieka nie da się dodzwonić.' },
  { id: 'obs-08', topic: 'obsluga_klienta', text: 'Obsługa klienta ignoruje wiadomości i zamyka zgłoszenia.' },
  { id: 'obs-09', topic: 'obsluga_klienta', text: 'Dostałem sprzeczne informacje od dwóch różnych konsultantów.' },
  { id: 'obs-10', topic: 'obsluga_klienta', text: 'Hotline działa tylko w godzinach, w których ja pracuję.' },
  { id: 'obs-11', topic: 'obsluga_klienta', text: 'Serwis potraktował mnie jak problem, a nie jak klienta.' },
  { id: 'obs-12', topic: 'obsluga_klienta', text: 'Szybka i konkretna pomoc na czacie, tak powinno wyglądać wsparcie.' },

  // dostawa
  { id: 'dos-01', topic: 'dostawa', text: 'Paczka przyszła z tygodniowym opóźnieniem i bez powiadomienia.' },
  { id: 'dos-02', topic: 'dostawa', text: 'Kurier zostawił przesyłkę pod drzwiami, choć miałem być w domu.' },
  { id: 'dos-03', topic: 'dostawa', text: 'Śledzenie zamówienia nie działało, status stał w miejscu.' },
  { id: 'dos-04', topic: 'dostawa', text: 'Dostawa była błyskawiczna, następnego dnia miałem paczkę.' },
  { id: 'dos-05', topic: 'dostawa', text: 'Punkt odbioru był zamknięty, musiałem jechać do innego miasta.' },
  { id: 'dos-06', topic: 'dostawa', text: 'Przesyłka zaginęła i dopiero po tygodniu ktoś ją odnalazł.' },
  { id: 'dos-07', topic: 'dostawa', text: 'Termin realizacji się nie zgadzał z tym, co było na stronie.' },
  { id: 'dos-08', topic: 'dostawa', text: 'Karton był zgnieciony, wyglądało jakby rzucali nim w sortowni.' },
  { id: 'dos-09', topic: 'dostawa', text: 'Brakowało opcji dostawy do paczkomatu w mojej okolicy.' },
  { id: 'dos-10', topic: 'dostawa', text: 'Kurier nie zadzwonił i od razu zostawił awizo.' },
  { id: 'dos-11', topic: 'dostawa', text: 'Czas wysyłki z magazynu jest za długi, nawet przed świętami.' },
  { id: 'dos-12', topic: 'dostawa', text: 'Dostarczyli pod zły adres, sąsiad oddał mi paczkę wieczorem.' },

  // jakość produktu
  { id: 'jak-01', topic: 'jakosc_produktu', text: 'Materiał jest cienki i po pierwszym praniu się rozciągnął.' },
  { id: 'jak-02', topic: 'jakosc_produktu', text: 'Urządzenie wyłącza się samo, jakość wykonania pozostawia wiele do życzenia.' },
  { id: 'jak-03', topic: 'jakosc_produktu', text: 'Szwy są krzywe, a plastik pękł po tygodniu użytkowania.' },
  { id: 'jak-04', topic: 'jakosc_produktu', text: 'Produkt działa solidnie, nic się nie rusza i wygląda na trwały.' },
  { id: 'jak-05', topic: 'jakosc_produktu', text: 'Po miesiącu farba zaczęła się łuszczyć na obudowie.' },
  { id: 'jak-06', topic: 'jakosc_produktu', text: 'Bateria trzyma dużo krócej niż deklaruje producent.' },
  { id: 'jak-07', topic: 'jakosc_produktu', text: 'Wykonanie jest staranne, elementy do siebie pasują.' },
  { id: 'jak-08', topic: 'jakosc_produktu', text: 'Towar przyszedł z wadą fabryczną, ekran miał martwe piksele.' },
  { id: 'jak-09', topic: 'jakosc_produktu', text: 'Po kilku użyciach uchwyt się poluzował i skrzypi.' },
  { id: 'jak-10', topic: 'jakosc_produktu', text: 'Jakość tkaniny jest słaba, nitki wystają już na starcie.' },
  { id: 'jak-11', topic: 'jakosc_produktu', text: 'Sprzęt działa bezawaryjnie od pół roku, jestem zadowolony z trwałości.' },
  { id: 'jak-12', topic: 'jakosc_produktu', text: 'Zapach plastiku jest ostry, a wykończenie wygląda tanio.' },
];
