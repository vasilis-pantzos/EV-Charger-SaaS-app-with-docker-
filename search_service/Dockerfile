# 1.
FROM python:3.11-slim

# 2.
WORKDIR /app

# 3.
COPY requirements.txt .

# 4. 
RUN pip install --no-cache-dir -r requirements.txt

# 5. 
COPY . .

# 6. 
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8086"]
