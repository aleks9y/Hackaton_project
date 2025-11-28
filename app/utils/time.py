from datetime import datetime
import pytz


def get_moscow_time():
    MOSCOW_TZ = pytz.timezone('Europe/Moscow')
    moscow_time = datetime.now(MOSCOW_TZ)
    return moscow_time.replace(tzinfo=None)


