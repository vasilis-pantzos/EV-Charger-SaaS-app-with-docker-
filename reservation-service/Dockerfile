# Χρησιμοποιούμε την επίσημη εικόνα της Python
FROM python:3.11-slim

# Φτιάχνουμε έναν φάκελο app μέσα στο container
WORKDIR /app

# Αντιγράφουμε το αρχείο με τα πακέτα που χρειαζόμαστε
COPY requirements.txt .

# Εγκαθιστούμε τα πακέτα (FastAPI, βιβλιοθήκη για MySQL, κλπ)
RUN pip install --no-cache-dir -r requirements.txt

# Αντιγράφουμε τον υπόλοιπο κώδικα
COPY . .

# Εντολή για να ξεκινήσει ο server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8083", "--reload"]