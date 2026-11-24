# PitStop

PitStop, araçları ve bakım kayıtlarını takip eden bir web uygulamasıdır. FastAPI hem web arayüzünü hem API'yi sunar. Hesaplar, oturumlar, araçlar ve bakım kayıtları SQLite'ta saklanır.

## Yerelde çalıştırma

Python 3.10 veya üzeri gerekir. Proje dizininden çalıştırın.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Tarayıcıda [PitStop](http://localhost:8000) veya [API belgeleri](http://localhost:8000/docs) sayfasını açabilirsiniz. Codex Cloud'da 8000 numaralı bağlantı noktasını önizleyin. Önce **Sign Up** ile hesap oluşturun. Ardından **My Garage** üzerinden araç ekleyip **Maintenance** bölümünde o araca bakım kaydı girebilirsiniz. **Expenses** yalnızca tamamlanmış bakımların masraflarını toplar.

SQLite dosyası ilk çalıştırmada `data/pitstop.sqlite3` yolunda oluşturulur. Farklı bir konum için `PITSTOP_DB_PATH` ortam değişkenini kullanabilirsiniz. Verinin kalıcı olması için bu dosyanın bulunduğu dizini koruyun.

Şifreler Argon2 ile hash'lenir. Oturumlar yedi gün geçerlidir ve çıkış yapıldığında sunucuda iptal edilir. HTTPS'yi bir ters vekil sunucuda sonlandırıyorsanız Uvicorn'un yalnızca güvenilir vekilden gelen protokol bilgisini kabul edecek şekilde yapılandırıldığından emin olun. FastAPI bu bilgiye göre oturum çerezinde `Secure` ayarını etkinleştirir.
