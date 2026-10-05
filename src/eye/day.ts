import type {Lang} from '../i18n';
// قصة «يوم في حياة العين». كلها محاكاة (SIM) ومعلّمة هكذا في الواجهة. لا أرقام مالية، ولا شيء يُرسل.
export type Tone='opp'|'watch'|'risk'|'calm';
export interface DayEvent{time:string;tone:Tone;approve:boolean}
export interface DayText{title:string;noticed:string;why:string;checked:string[];rec:string}
export const DAY:DayEvent[]=[
{time:'07:12',tone:'opp',approve:true},{time:'08:03',tone:'watch',approve:true},{time:'09:17',tone:'opp',approve:true},
{time:'11:42',tone:'opp',approve:true},{time:'13:05',tone:'opp',approve:true},{time:'16:20',tone:'calm',approve:false},
{time:'18:40',tone:'risk',approve:true},{time:'19:05',tone:'risk',approve:true},{time:'22:10',tone:'calm',approve:false},{time:'22:15',tone:'calm',approve:false}];
const T=(title:string,noticed:string,why:string,checked:string[],rec:string):DayText=>({title,noticed,why,checked,rec});
export const DAYTXT:Record<Lang,DayText[]>={
en:[
T('A quiet opportunity is forming','A conference in Riyadh is nine days away, and a parked aircraft sits at Dubai.','An event signal plus an aircraft already positioned nearby. Parked does not mean available.',['Event source recorded','Aircraft position from public tracking, not availability'],'Prepare a short availability message for the operator to confirm.'),
T('Weather may affect the Paris arrival','Crosswind is rising in the 14:00–16:00 arrival window.','The landing window may get shorter.',['Observation and forecast both read','An earlier departure time','An alternate airport'],'Depart 25 minutes earlier, subject to operator and crew confirmation.'),
T('An empty leg matches a possible request','Dubai to Cairo is a repositioning leg, and a possible request exists from Cairo to London.','One aircraft could fly both legs instead of one flying empty.',['Aircraft category fits the seats','The two time windows overlap'],'Build an offer draft. The operator confirms availability before anything reaches a customer.'),
T('A better-placed aircraft was found','A larger-cabin aircraft is positioned closer to the departure airport.','Less positioning time and more cabin room for the group.',['Range covers the route','Both airports accept this aircraft type'],'Switch to it, once the operator confirms it is available.'),
T('The client offer is ready','Three options are drafted using the preferences the client gave.','The client should not have to repeat what they already told us.',['Preferences come only from the client’s own answers','Price status: pending operator quote'],'Review the draft. Nothing is sent until you approve.'),
T('Watching the flight','The flight is on schedule.','Nothing has changed since the last check.',['Departure and arrival times','Weather at both airports'],'No action needed.'),
T('A delay is possible','Departure may slip by about 40 minutes.','The driver and the airport handler are timed to the original departure.',['Ground transfer timing','Handler opening hours'],'Move the driver’s pickup later. Draft ready for you to approve.'),
T('Plan B is ready','The backup option is prepared.','If the delay grows, the client still arrives on a workable schedule.',['A backup aircraft','An alternate airport'],'Approve switching to Plan B only if the delay is confirmed.'),
T('The flight is complete','The aircraft has landed.','The outcome is recorded so the next trip starts better.',['Outcome saved for learning'],'Nothing to do.'),
T('Nothing else needs your attention.','The network is quiet.','Everything open has been handled or handed to a person.',['All open items'],'The Eye keeps watching.')],
ar:[
T('فرصة هادئة تتشكّل','مؤتمر في الرياض بعد تسعة أيام، وطائرة رابضة في دبي.','إشارة فعالية تقترن بطائرة قريبة، ووجودها على الأرض لا يعني أنها متاحة.',['سُجّل مصدر الفعالية','موضع الطائرة مصدره تتبّع عام، وليس توافرًا'],'أعِدّ رسالة توافر موجزة ليؤكدها المشغّل.'),
T('قد يؤثر الطقس في الوصول إلى باريس','تشتدّ الرياح الجانبية في نافذة الوصول 14:00–16:00.','قد تقصر نافذة الهبوط.',['قرأتُ الرصد والتوقّعات معًا','موعد إقلاع أبكر','مطارًا بديلًا'],'الإقلاع قبل 25 دقيقة، بشرط تأكيد المشغّل والطاقم.'),
T('رحلة خالية تُطابق طلبًا محتملًا','دبي إلى القاهرة رحلة تموضع، وهناك طلب محتمل من القاهرة إلى لندن.','قد تؤدّي طائرة واحدة الرحلتين بدل أن تطير إحداهما خالية.',['فئة الطائرة تناسب المقاعد','نافذتا الوقت تتقاطعان'],'أعِدّ مسودة عرض، على أن يؤكد المشغّل التوافر قبل أن يصل شيء إلى أي عميل.'),
T('وجدتُ طائرة أنسب موضعًا','طائرة بمقصورة أكبر موجودة أقرب إلى مطار الإقلاع.','وقت تموضع أقل ومساحة أكبر للمجموعة.',['المدى يغطي المسار','المطاران يستقبلان هذا النوع'],'التحويل إليها بعد أن يؤكد المشغّل أنها متاحة.'),
T('عرض العميل مُعدّ','ثلاثة خيارات صيغت وفق تفضيلات أفصح عنها العميل.','لا ينبغي أن يكرر العميل ما سبق أن قاله لنا.',['التفضيلات من إجابات العميل نفسه فقط','حالة السعر: بانتظار عرض المشغّل'],'راجع المسودة. ولن يُرسَل شيء حتى تُقرّها.'),
T('أرقب الرحلة','الرحلة في موعدها.','لم يطرأ تغيير منذ آخر مراجعة.',['موعدا الإقلاع والوصول','الطقس في المطارين'],'لا يلزم أي إجراء.'),
T('تأخير محتمل','قد يتأخر الإقلاع نحو 40 دقيقة.','السائق وموظف المطار مرتبطان بموعد الإقلاع الأصلي.',['توقيت النقل الأرضي','ساعات عمل موظف المطار'],'تأجيل موعد التقاط السائق. المسودة مُعدّة لتُقرّها.'),
T('الخطة البديلة مُعدّة','أعددتُ الخيار البديل.','إن زاد التأخير بلغ العميل وجهته وفق جدول مقبول.',['طائرة بديلة','مطار بديل'],'أقرّ التحويل إلى الخطة البديلة إذا تأكّد التأخير فقط.'),
T('انتهت الرحلة','الطائرة هبطت.','سُجّلت النتيجة لتكون الرحلة القادمة أفضل.',['حُفظت النتيجة للتعلّم'],'لا شيء مطلوب.'),
T('لا شيء آخر يستوجب انتباهك.','الشبكة هادئة.','كل ما كان مفتوحًا جرت معالجته أو أُسند إلى شخص.',['جميع البنود المفتوحة'],'العين تواصل سهرها.')],
tr:[
T('Sessiz bir fırsat oluşuyor','Riyad’da bir konferansa dokuz gün var ve Dubai’de park halinde bir uçak duruyor.','Bir etkinlik sinyali ve yakında konumlanmış bir uçak. Park halinde olmak müsait olmak demek değildir.',['Etkinlik kaynağı kaydedildi','Uçak konumu açık takipten, müsaitlik değil'],'Operatörün onaylaması için kısa bir müsaitlik mesajı hazırla.'),
T('Hava durumu Paris varışını etkileyebilir','14:00–16:00 varış penceresinde yan rüzgâr artıyor.','İniş penceresi kısalabilir.',['Gözlem ve tahmin birlikte okundu','Daha erken kalkış saati','Alternatif havalimanı'],'25 dakika erken kalkın; operatör ve mürettebat onayına bağlı.'),
T('Boş bir bacak olası bir talebe uyuyor','Dubai–Kahire bir konumlandırma bacağı ve Kahire–Londra için olası bir talep var.','Bir uçak boş uçmak yerine iki bacağı da uçabilir.',['Uçak kategorisi koltuklara uygun','İki zaman penceresi örtüşüyor'],'Teklif taslağı hazırla. Müşteriye bir şey gitmeden önce operatör müsaitliği onaylar.'),
T('Daha iyi konumlanmış bir uçak bulundu','Daha geniş kabinli bir uçak kalkış havalimanına daha yakın.','Daha az konumlandırma süresi ve grup için daha fazla alan.',['Menzil rotayı kapsıyor','İki havalimanı da bu tipi kabul ediyor'],'Operatör müsait olduğunu onayladıktan sonra ona geçin.'),
T('Müşteri teklifi hazır','Müşterinin söylediği tercihlere göre üç seçenek hazırlandı.','Müşterinin bize söylediklerini tekrar etmesi gerekmemeli.',['Tercihler yalnızca müşterinin kendi yanıtlarından','Fiyat durumu: operatör teklifi bekleniyor'],'Taslağı inceleyin. Siz onaylamadan hiçbir şey gönderilmez.'),
T('Uçuş izleniyor','Uçuş tarifesinde.','Son kontrolden beri bir şey değişmedi.',['Kalkış ve varış saatleri','İki havalimanında hava durumu'],'İşlem gerekmiyor.'),
T('Gecikme olası','Kalkış yaklaşık 40 dakika kayabilir.','Şoför ve yer hizmetleri ilk kalkış saatine göre ayarlı.',['Yer transferi zamanlaması','Yer hizmeti çalışma saatleri'],'Şoförün alış saatini geciktirin. Onayınız için taslak hazır.'),
T('B planı hazır','Yedek seçenek hazırlandı.','Gecikme uzarsa müşteri yine uygun bir programla varır.',['Yedek uçak','Alternatif havalimanı'],'B planına geçişi yalnızca gecikme kesinleşirse onaylayın.'),
T('Uçuş tamamlandı','Uçak indi.','Sonuç kaydedildi; bir sonraki uçuş daha iyi başlasın.',['Sonuç öğrenme için kaydedildi'],'Yapılacak bir şey yok.'),
T('Dikkatinizi gerektiren başka bir şey yok.','Ağ sakin.','Açık olan her şey çözüldü ya da bir kişiye devredildi.',['Tüm açık kalemler'],'Göz izlemeye devam ediyor.')],
ru:[
T('Формируется тихая возможность','Через девять дней конференция в Эр-Рияде, а в Дубае стоит самолёт.','Сигнал о событии и самолёт, уже находящийся рядом. Стоянка не значит «доступен».',['Источник события записан','Позиция самолёта из открытого трекинга, а не доступность'],'Подготовить короткое сообщение о доступности для подтверждения оператором.'),
T('Погода может повлиять на прилёт в Париж','Боковой ветер усиливается в окне прилёта 14:00–16:00.','Окно посадки может сократиться.',['Прочитаны и наблюдения, и прогноз','Более ранний вылет','Запасной аэропорт'],'Вылететь на 25 минут раньше, при подтверждении оператора и экипажа.'),
T('Пустой рейс совпал с возможным запросом','Дубай — Каир — перегонный рейс, и есть возможный запрос Каир — Лондон.','Один самолёт мог бы выполнить оба рейса вместо одного пустого.',['Категория самолёта подходит по местам','Два временных окна пересекаются'],'Подготовить черновик предложения. Оператор подтверждает доступность до того, как что-то дойдёт до клиента.'),
T('Найден самолёт, расположенный удачнее','Самолёт с более просторным салоном находится ближе к аэропорту вылета.','Меньше времени на перегон и больше места для группы.',['Дальность покрывает маршрут','Оба аэропорта принимают этот тип'],'Перейти на него после подтверждения доступности оператором.'),
T('Предложение для клиента готово','Три варианта составлены по предпочтениям, названным клиентом.','Клиенту не нужно повторять то, что он уже сказал.',['Предпочтения только из ответов самого клиента','Статус цены: ждём предложение оператора'],'Проверьте черновик. Ничего не отправится, пока вы не одобрите.'),
T('Наблюдаю за рейсом','Рейс идёт по расписанию.','С прошлой проверки ничего не изменилось.',['Время вылета и прилёта','Погода в обоих аэропортах'],'Действий не требуется.'),
T('Возможна задержка','Вылет может сдвинуться примерно на 40 минут.','Водитель и наземный агент рассчитаны на исходное время вылета.',['Время наземного трансфера','Часы работы наземного агента'],'Сдвинуть подачу водителя. Черновик готов для вашего одобрения.'),
T('План Б готов','Запасной вариант подготовлен.','Если задержка вырастет, клиент всё равно прибудет по приемлемому графику.',['Запасной самолёт','Запасной аэропорт'],'Одобряйте переход на план Б, только если задержка подтвердится.'),
T('Рейс завершён','Самолёт приземлился.','Итог записан, чтобы следующий рейс начался лучше.',['Итог сохранён для обучения'],'Ничего делать не нужно.'),
T('Больше ничто не требует вашего внимания.','В сети тихо.','Всё открытое решено или передано человеку.',['Все открытые пункты'],'Глаз продолжает наблюдать.')]
};
