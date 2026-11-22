FROM python:3.11-slim

ARG TORBOT_COMMIT=a7000496a02adeb4d66ea4453c1ea52bcdaddc2d
ENV TORBOT_COMMIT=${TORBOT_COMMIT} \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends git tor ca-certificates \
 && rm -rf /var/lib/apt/lists/*

RUN git clone -q https://github.com/DedSecInside/TorBot.git /opt/torbot \
 && cd /opt/torbot \
 && git checkout -q ${TORBOT_COMMIT} \
 && pip install --no-cache-dir -r requirements.txt

WORKDIR /app
COPY runner.py /app/runner.py
RUN useradd -m -u 10001 runner \
 && mkdir -p /tmp/torbot-data /tmp/torbot-out \
 && chown -R runner:runner /tmp/torbot-data /tmp/torbot-out
USER runner

EXPOSE 9055
CMD ["python", "/app/runner.py"]
