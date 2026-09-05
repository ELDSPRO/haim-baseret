(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FilmEvents = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Original fictional situations and game effects, not real prices or schedules.
  // Fixed data only: the engine owns selection, affordability and state changes.
  const BY_CITY = {
    tel_aviv: [
      {
        id: 'tel_aviv_cable_delivery',
        title: 'הכבל אצל חבר של חבר',
        body: 'סט בדרום תל אביב צריך כבל שנמצא שלושה רחובות ממנו. שרשרת ההיכרות כבר הגיעה לחיפה.',
        options: [
          { label: 'לקחת את השליחות בתשלום', description: '+160 ₪, −6 אנרגיה.', effects: { cash: 160, energy: -6 } },
          { label: 'לחבר אותם לטכנאי מהשכונה', description: '+5 קשרים, +2 מוניטין.', effects: { contacts: 5, reputation: 2 } }
        ]
      },
      {
        id: 'tel_aviv_rooftop_screening',
        title: 'הגג קיבל תוכנייה',
        body: 'חברים מארגנים ערב סרטים על גג ביפו. יש מקרן, כיסאות משלושה בתים ודיון רציני על כבל מאריך.',
        options: [
          { label: 'להשתתף באוכל ולהישאר לשיחה', description: '−90 ₪, +6 אושר, +4 קשרים.', effects: { cash: -90, happiness: 6, contacts: 4 } },
          { label: 'לסדר את ההקרנה', description: '+4 מיומנות, +2 מוניטין, −4 אנרגיה.', effects: { craft: 4, reputation: 2, energy: -4 } }
        ]
      },
      {
        id: 'tel_aviv_shared_bills',
        title: 'גם לחשבון יש גרסאות',
        body: 'השותפים בדירה בפלורנטין גילו חיוב כפול. קובץ ההוצאות נקרא כבר חשבון_סופי_באמת.',
        options: [
          { label: 'לברר ולקבל את ההחזר', description: '+120 ₪, −3 אנרגיה.', effects: { cash: 120, energy: -3 } },
          { label: 'לתת לשותף לטפל ולבשל לכולם', description: '−70 ₪, +10 אושר, +3 אנרגיה.', effects: { cash: -70, happiness: 10, energy: 3 } }
        ]
      },
      {
        id: 'tel_aviv_station_meeting',
        title: 'הפגישה בדרך לרכבת',
        body: 'מפיקה שעוברת בתל אביב מציעה שיחה ליד התחנה. ביומן זה קפה; בפועל זה פיץ׳ עם גלגלי מזוודה.',
        options: [
          { label: 'להגיע בנסיעה מיוחדת', description: '−100 ₪, +5 קשרים, +2 מוניטין.', effects: { cash: -100, contacts: 5, reputation: 2 } },
          { label: 'לקבוע שיחת וידאו קצרה', description: '+3 קשרים, +4 אנרגיה.', effects: { contacts: 3, energy: 4 } }
        ]
      },
      {
        id: 'tel_aviv_bilingual_joke',
        title: 'הבדיחה לא נכנסת לשורה',
        body: 'בהקרנה דו־לשונית ביפו, בדיחה קצרה תופסת שלוש שורות כתוביות. הקהל עוד לא הגיע וכבר אין לו זמן לקרוא.',
        options: [
          { label: 'לעבוד עם מתרגמת מנוסה', description: '−140 ₪, +6 מיומנות, +3 קשרים.', effects: { cash: -140, craft: 6, contacts: 3 } },
          { label: 'ללטש יחד עם מתנדב מההקרנה', description: '+4 מיומנות, +2 מוניטין, −5 אנרגיה.', effects: { craft: 4, reputation: 2, energy: -5 } }
        ]
      },
      {
        id: 'tel_aviv_beach_neighbors',
        title: 'הים ביקש יום בלי בריף',
        body: 'שכנים מארגנים ניקיון קטן בחוף ואחריו ישיבה יחד. בקבוצה ביקשו שקיות; מישהו כבר הציע לוגו.',
        options: [
          { label: 'לעזור ולהכיר את השכנים', description: '+10 אושר, +4 קשרים, −5 אנרגיה.', effects: { happiness: 10, contacts: 4, energy: -5 } },
          { label: 'להכין להם סרטון הזמנה קצר', description: '+5 מיומנות, +3 מוניטין, −6 אנרגיה.', effects: { craft: 5, reputation: 3, energy: -6 } }
        ]
      }
    ],
    athens: [
      {
        id: 'athens_hill_scout',
        title: 'המסלול קצר על המפה',
        body: 'צוות מקומי מזמין לסיור לוקיישנים ליד גבעת פילופאפוס. בתמונה השביל שטוח. הרגליים מבקשות לדבר עם הצלם.',
        options: [
          { label: 'לשלם על הסעת הציוד', description: '−90 ₪, +4 מיומנות, +4 אנרגיה.', effects: { cash: -90, craft: 4, energy: 4 } },
          { label: 'לעלות יחד ולחפש פריימים', description: '+5 מיומנות, +4 אושר, −6 אנרגיה.', effects: { craft: 5, happiness: 4, energy: -6 } }
        ]
      },
      {
        id: 'athens_screening_conversation',
        title: 'שאלה מהשורה השלישית',
        body: 'קולנוע שכונתי באתונה מזמין לשיחת יוצרים. השאלה הראשונה ביוונית; החיוך שלך כבר מחזיק יותר מדי זמן.',
        options: [
          { label: 'להיעזר במנחה שמתרגמת', description: '−100 ₪, +5 קשרים, +3 מוניטין.', effects: { cash: -100, contacts: 5, reputation: 3 } },
          { label: 'להסביר דרך קטעים ודוגמאות', description: '+4 מיומנות, +3 קשרים, −3 אנרגיה.', effects: { craft: 4, contacts: 3, energy: -3 } }
        ]
      },
      {
        id: 'athens_balcony_office',
        title: 'המרפסת נהייתה משרד',
        body: 'השכן באתונה שמע שלוש שיחות עבודה דרך המרפסת. הוא מבקש קצת שקט, וגם שואל אם מצלמים סרטונים לעסק.',
        options: [
          { label: 'לקבוע גבולות ולסגור את הלפטופ', description: '+8 אושר, +5 אנרגיה.', effects: { happiness: 8, energy: 5 } },
          { label: 'לקחת סרטון קטן בתשלום', description: '+140 ₪, +2 קשרים, −5 אנרגיה.', effects: { cash: 140, contacts: 2, energy: -5 } }
        ]
      },
      {
        id: 'athens_lane_sound',
        title: 'הסמטה עושה סאונד',
        body: 'בסיור בפלאקה, יוצרת מקומית שומעת סיפור בין הצעדים והתריסים. ההקלטה שלך מכילה בעיקר את רוכסן התיק.',
        options: [
          { label: 'להישאר ולתרגל הקלטת שטח', description: '+6 מיומנות, −6 אנרגיה.', effects: { craft: 6, energy: -6 } },
          { label: 'להזמין הדרכה קצרה ולהמשיך קל', description: '−80 ₪, +4 קשרים, +6 אנרגיה.', effects: { cash: -80, contacts: 4, energy: 6 } }
        ]
      },
      {
        id: 'athens_extra_chair',
        title: 'קפה עם עוד כיסא',
        body: 'בבית קפה באתונה, מפיק מזמין מנהלת הפקה מקומית לשולחן. הכיסא הנוסף הגיע לפני שהפיץ׳ היה מוכן.',
        options: [
          { label: 'להזמין משהו לשולחן ולהישאר', description: '−70 ₪, +6 קשרים, +5 אושר.', effects: { cash: -70, contacts: 6, happiness: 5 } },
          { label: 'להציע הליכה ושיחה קצרה', description: '+4 קשרים, +5 אנרגיה.', effects: { contacts: 4, energy: 5 } }
        ]
      },
      {
        id: 'athens_pitch_translation',
        title: 'התיק הגיע בגרסה שלישית',
        body: 'שותפה באתונה קוראת את תיק ההפקה המתורגם. הביטוי ״לסגור פינות״ נשמע כאילו הסרט עוסק בשיפוצים.',
        options: [
          { label: 'לשלם על עריכה לשונית משותפת', description: '−160 ₪, +5 מיומנות, +3 מוניטין.', effects: { cash: -160, craft: 5, reputation: 3 } },
          { label: 'להחליף משוב עם יוצר מקומי', description: '+4 קשרים, +3 מיומנות, −4 אנרגיה.', effects: { contacts: 4, craft: 3, energy: -4 } }
        ]
      }
    ],
    berlin: [
      {
        id: 'berlin_bicycle_locations',
        title: 'האופניים מכירים קיצור',
        body: 'צלמת בברלין מציעה סיור לוקיישנים באופניים. יש לה זוג נוסף ותיאוריה קולנועית על כל גשר.',
        options: [
          { label: 'לצאת לסיור יחד', description: '+5 מיומנות, +3 קשרים, −6 אנרגיה.', effects: { craft: 5, contacts: 3, energy: -6 } },
          { label: 'להיפגש לקפה בסוף המסלול', description: '−70 ₪, +4 קשרים, +7 אושר.', effects: { cash: -70, contacts: 4, happiness: 7 } }
        ]
      },
      {
        id: 'berlin_courtyard_students',
        title: 'השקט נכנס לתקציב',
        body: 'סטודנטים מבקשים לצלם בחצר הבניין בברלין. השכנים רוצים להבין מה זה ״רק טייק אחד״ לפני שהם מסכימים.',
        options: [
          { label: 'לתווך שיחה עם השכנים', description: '+5 קשרים, +4 אושר, −4 אנרגיה.', effects: { contacts: 5, happiness: 4, energy: -4 } },
          { label: 'לקחת עבודת תיאום בתשלום', description: '+180 ₪, −3 אושר, −5 אנרגיה.', effects: { cash: 180, happiness: -3, energy: -5 } }
        ]
      },
      {
        id: 'berlin_pitch_subtitles',
        title: 'בעברית זה נשמע מצוין',
        body: 'קבוצת יוצרים בברלין צופה בסרטון הפיץ׳ שלך. בגרמנית המשפט האחרון נשמע כמו הוראות הרכבה.',
        options: [
          { label: 'לעבוד עם מתרגם על הכוונה', description: '−120 ₪, +5 מיומנות, +3 מוניטין.', effects: { cash: -120, craft: 5, reputation: 3 } },
          { label: 'לקצר ולהסביר דרך תמונות', description: '+4 מיומנות, +4 אושר, −4 אנרגיה.', effects: { craft: 4, happiness: 4, energy: -4 } }
        ]
      },
      {
        id: 'berlin_editing_coop',
        title: 'התפנה מסך גדול',
        body: 'חלל עריכה משותף בברלין פותח מפגש מקצועי. המסך ענק; גם רשימת הקבצים שצריך לסדר.',
        options: [
          { label: 'להצטרף לסדנת העריכה', description: '−90 ₪, +6 מיומנות, +3 קשרים.', effects: { cash: -90, craft: 6, contacts: 3 } },
          { label: 'לקחת משמרת סידור חומרים', description: '+140 ₪, +2 מיומנות, −7 אנרגיה.', effects: { cash: 140, craft: 2, energy: -7 } }
        ]
      },
      {
        id: 'berlin_screening_ending',
        title: 'אף אחד לא מסכים על הסוף',
        body: 'אחרי הקרנה עצמאית בקרויצברג מתפתחות שתי שיחות על אותו סרט. שתיהן בטוחות שהשנייה פספסה אותו.',
        options: [
          { label: 'לחבר בין השיחות', description: '+5 קשרים, +3 מוניטין, −4 אנרגיה.', effects: { contacts: 5, reputation: 3, energy: -4 } },
          { label: 'לצאת להליכה ליד התעלה', description: '+9 אושר, +7 אנרגיה.', effects: { happiness: 9, energy: 7 } }
        ]
      },
      {
        id: 'berlin_tempelhof_rehearsal',
        title: 'הרוח עושה חזרה',
        body: 'בטמפלהוף, שני יוצרים מתרגלים סצנה והרוח הופכת להם את הדפים. בינתיים היא היחידה שזוכרת מתי להיכנס.',
        options: [
          { label: 'להצטרף לתרגיל האלתור', description: '+4 מיומנות, +8 אושר, −4 אנרגיה.', effects: { craft: 4, happiness: 8, energy: -4 } },
          { label: 'להניח את התיק ולנוח על הדשא', description: '+12 אושר, +8 אנרגיה.', effects: { happiness: 12, energy: 8 } }
        ]
      }
    ],
    london: [
      {
        id: 'london_bus_pitch',
        title: 'הפיץ׳ בקומה העליונה',
        body: 'בנסיעה באוטובוס בלונדון, מפיק מהמפגש הקודם שואל על הרעיון שלך. סוף סוף יש קהל שבינתיים לא יורד.',
        options: [
          { label: 'לספר את הסיפור במשפטים קצרים', description: '+5 קשרים, +3 מוניטין.', effects: { contacts: 5, reputation: 3 } },
          { label: 'לשאול על הסרט שלו ולהקשיב', description: '+3 מיומנות, +3 קשרים, +4 אושר.', effects: { craft: 3, contacts: 3, happiness: 4 } }
        ]
      },
      {
        id: 'london_rain_cover',
        title: 'הגשם מבקש קרדיט',
        body: 'צוות ברחוב בלונדון מבקש עזרה בכיסוי ציוד. אף אחד לא ליהק את הענן הזה, אבל הוא מתעקש להישאר.',
        options: [
          { label: 'לקנות כיסויים ולחזור לצוות', description: '−110 ₪, +4 מוניטין, +5 קשרים.', effects: { cash: -110, reputation: 4, contacts: 5 } },
          { label: 'לעזור לשאת את הציוד פנימה', description: '+3 מיומנות, +4 קשרים, −7 אנרגיה.', effects: { craft: 3, contacts: 4, energy: -7 } }
        ]
      },
      {
        id: 'london_screening_queue',
        title: 'התור הפך לפגישה',
        body: 'בתור להקרנה בסאות׳ בנק, שיחה על עדשות הופכת להיכרות עם צוות מקומי. הסרט עוד לא התחיל וכבר יש קרדיטים.',
        options: [
          { label: 'להזמין משקה ולהמשיך לדבר', description: '−90 ₪, +6 קשרים, +5 אושר.', effects: { cash: -90, contacts: 6, happiness: 5 } },
          { label: 'להחליף פרטים ולשמור על הפסקה', description: '+4 קשרים, +2 מוניטין, −3 אנרגיה.', effects: { contacts: 4, reputation: 2, energy: -3 } }
        ]
      },
      {
        id: 'london_flatmate_audition',
        title: 'האודישן בסלון',
        body: 'השותפה בדירה בלונדון מציעה תשלום על צילום אודישן. הכביסה מאחוריה כבר מוכנה לתפקיד תקופתי.',
        options: [
          { label: 'לסדר פריים ולצלם איתה', description: '+180 ₪, +2 מיומנות, −6 אנרגיה.', effects: { cash: 180, craft: 2, energy: -6 } },
          { label: 'לפנות לה שקט ולצאת להפסקה', description: '+7 אושר, +6 אנרגיה.', effects: { happiness: 7, energy: 6 } }
        ]
      },
      {
        id: 'london_archive_boxes',
        title: 'הארכיון פתח עוד תיק',
        body: 'יוצרת דוקו בלונדון מצאה אוסף ראיונות ומזמינה לעזור. על כל קופסה כתוב ״חשוב״, מה שמקל מאוד על המיון.',
        options: [
          { label: 'להשתתף בהדרכה של ארכיונאי', description: '−140 ₪, +6 מיומנות, +4 קשרים.', effects: { cash: -140, craft: 6, contacts: 4 } },
          { label: 'לקחת משמרת מיון בתשלום', description: '+200 ₪, +2 מיומנות, −7 אנרגיה.', effects: { cash: 200, craft: 2, energy: -7 } }
        ]
      },
      {
        id: 'london_noon_timezone',
        title: 'למי שייכת שעת הצהריים',
        body: 'הלקוח בישראל והצלמת בלונדון סימנו ״צהריים״ בלי אזור זמן. ליומן יש עכשיו שתי דעות, ושתיהן שלחו תזכורת.',
        options: [
          { label: 'לתאם שיחה קצרה שמתאימה לכולם', description: '+4 קשרים, +3 מוניטין, −3 אנרגיה.', effects: { contacts: 4, reputation: 3, energy: -3 } },
          { label: 'לשלוח הערות מצולמות במקום', description: '+4 מיומנות, +8 אנרגיה.', effects: { craft: 4, energy: 8 } }
        ]
      }
    ],
    los_angeles: [
      {
        id: 'los_angeles_cross_city_meeting',
        title: 'הפגישה בקצה השני של העיר',
        body: 'מנהלת הפקה בלוס אנג׳לס מציעה להיפגש ״ממש קרוב״. היא מתכוונת קרוב אליה, וזה משנה את התמונה.',
        options: [
          { label: 'להשקיע בנסיעה ולהגיע', description: '−140 ₪, +6 קשרים, +3 מוניטין.', effects: { cash: -140, contacts: 6, reputation: 3 } },
          { label: 'להציע היכרות בווידאו', description: '+3 קשרים, +8 אנרגיה.', effects: { contacts: 3, energy: 8 } }
        ]
      },
      {
        id: 'los_angeles_backyard_screen',
        title: 'המסך בחצר והשכן בדלת',
        body: 'חברים בלוס אנג׳לס מארגנים הקרנה בחצר. השכן בא לשאול על הרעש ונשאר לשאול מי צילם את השוט הראשון.',
        options: [
          { label: 'להוסיף כיסא ולפתוח שיחה', description: '+8 אושר, +4 קשרים.', effects: { happiness: 8, contacts: 4 } },
          { label: 'לעזור לשכור פתרון האזנה שקט', description: '−120 ₪, +4 מיומנות, +4 מוניטין.', effects: { cash: -120, craft: 4, reputation: 4 } }
        ]
      },
      {
        id: 'los_angeles_early_call',
        title: 'בוקר כאן, סוף יום שם',
        body: 'קבוצת יוצרים בישראל מזמינה אותך מלוס אנג׳לס לשיחת משוב. אצלם סיכום יום; אצלך הקומקום עוד בשלב הפיתוח.',
        options: [
          { label: 'לקום ולהצטרף לשיחה', description: '+5 קשרים, +3 מוניטין, −7 אנרגיה.', effects: { contacts: 5, reputation: 3, energy: -7 } },
          { label: 'לשלוח הערות אחרי שנת לילה', description: '+4 מיומנות, +4 אנרגיה.', effects: { craft: 4, energy: 4 } }
        ]
      },
      {
        id: 'los_angeles_prop_return',
        title: 'הספה סיימה צילומים',
        body: 'מחסן אביזרים בלוס אנג׳לס צריך עזרה בהחזרות. ספה אחת הייתה כבר בשלוש משפחות טלוויזיוניות ולא שילמה שכירות.',
        options: [
          { label: 'לקחת משמרת החזרות', description: '+250 ₪, −8 אנרגיה.', effects: { cash: 250, energy: -8 } },
          { label: 'להצטרף להדגמת עיצוב הסט', description: '+6 מיומנות, +4 אושר, −3 אנרגיה.', effects: { craft: 6, happiness: 4, energy: -3 } }
        ]
      },
      {
        id: 'los_angeles_echo_park_picnic',
        title: 'הפיקניק קיבל תקציר',
        body: 'חברים נפגשים באקו פארק ומסכימים להשאיר לפטופים בבית. מישהו הביא מחברת, אבל טוען שזה בשביל רשימת הקניות.',
        options: [
          { label: 'להביא אוכל ולנוח עם כולם', description: '−100 ₪, +12 אושר, +5 אנרגיה.', effects: { cash: -100, happiness: 12, energy: 5 } },
          { label: 'להביא תרמוס ולעזור לארגן', description: '+4 קשרים, +8 אושר, −2 אנרגיה.', effects: { contacts: 4, happiness: 8, energy: -2 } }
        ]
      },
      {
        id: 'los_angeles_voice_test',
        title: 'הקול נשמע כמו טריילר',
        body: 'יוצר בלוס אנג׳לס מחפש קריינות זמנית לסרטון ניסיון. בקריאה הראשונה הכרזת בטעות מלחמה על פרסומת לסבון.',
        options: [
          { label: 'להקליט גרסה רגועה בתשלום', description: '+180 ₪, +3 מוניטין, −6 אנרגיה.', effects: { cash: 180, reputation: 3, energy: -6 } },
          { label: 'להירשם להדרכת עבודה עם קול', description: '−130 ₪, +6 מיומנות, +5 אושר.', effects: { cash: -130, craft: 6, happiness: 5 } }
        ]
      }
    ]
  };

  return { BY_CITY };
});
