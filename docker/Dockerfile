# Docker Container to provide Agility's Runtime Environment
# MGateway Ltd
# 24 August 2026

# Version 2.0
FROM debian:trixie

RUN echo "Building Agility Container Version 2.0"

ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get upgrade -y

RUN apt-get install -y \
  build-essential \
  make \
  gcc \
  curl \
  git \
  wget \
  dos2unix \
  locate \
  nano \
  xinetd \
  file  \
  libtinfo6 \
  lsb-release \
  lsof \
  libelf1 \
  pkg-config \
  libelf-dev \
  libicu-dev \
  libssl-dev \
  libicu-dev \
  libpcre2-dev \
  zlib1g-dev \
  libgd-dev \
  locales \
  pkg-config \
  file \
  python3 \
  procps \
  apache2-utils \
  unzip

# Create app directory
RUN mkdir -p /opt/agility \
 && mkdir /opt/yottadb \
 && mkdir /opt/mg_web  \
 && mkdir /opt/agility/m

WORKDIR /opt/agility
RUN echo 'Copy files'
COPY ./files /opt/agility

RUN locale-gen "en_US.UTF-8"

RUN mkdir -p /var/www/html

# Get mg-web

RUN git clone https://github.com/chrisemunt/mg_web  \
 && cp /opt/agility/mg_web/src/*.h /opt/mg_web \
 && cp /opt/agility/mg_web/src/*.c /opt/mg_web \
 && cp /opt/agility/mg_web/src/nginx/* /opt/mg_web \
 && cd /opt/mg_web \
 && dos2unix *

RUN cd /opt/agility \
 && dos2unix * \
 && chmod +x ydb \
 && chmod +x ydb_run \
 && chmod +x ydb_run_temp \
 && chmod +x start \
 && chmod +x stop_ydb \
 && chmod +x stop_ydb_procs \
 && chmod +x rundown \
 && chmod +x nginx \
 && chmod +x g \
 && chmod +x gd

# Install NGINX

RUN cd /opt \
  && wget https://nginx.org/download/nginx-1.30.4.tar.gz \
  && tar zxf nginx-1.30.4.tar.gz \
  && cd nginx-1.30.4 \
  && CFLAGS=-Wno-error ./configure --prefix=/var/www/html --sbin-path=/usr/sbin/nginx --conf-path=/etc/nginx/nginx.conf --http-log-path=/var/log/nginx/access.log --error-log-path=/var/log/nginx/error.log --with-pcre --lock-path=/var/lock/nginx.lock --pid-path=/var/run/nginx.pid --with-http_ssl_module --with-http_image_filter_module=dynamic --modules-path=/etc/nginx/modules --with-http_v2_module --with-stream=dynamic --with-http_addition_module --with-http_mp4_module --with-threads --add-module=/opt/mg_web \
  && make \
  && make install

RUN mv /opt/agility/nginx.conf /etc/nginx

# ===  Install Node.js & NPM

RUN echo "Installing NVM plus latest Node.js"

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash \
  && echo 'export NVM_DIR="$HOME/.nvm"' >> .bashrc \
  && echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm' >> .bashrc \
  && export NVM_DIR="$HOME/.nvm" \
  && [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" \  && nvm install 24 \
  && npm install qoper8-fastify mg-bun-router glsdb mg-dbx-napi @fastify/static mgw-router mg_web_js json5 redis \
  && npm install autocannon -g

# Install Bun

RUN curl -fsSL https://bun.sh/install | bash \
  && export BUN_INSTALL="$HOME/.bun" \
  && export PATH="$BUN_INSTALL/bin:$PATH" \
  && echo "Installed Bun version:" \
  && bun -v

RUN echo "Installing YottaDB..."

RUN mkdir /tmp/tmp \
  && wget -P /tmp/tmp https://download.yottadb.com/ydbinstall.sh \
  && cd /tmp/tmp \
  && chmod +x ydbinstall.sh \
  && ./ydbinstall.sh --utf8 default --verbose --force-install \
  && export ydb_gbldir=/opt/yottadb/yottadb.gld \
  && /usr/local/lib/yottadb/r206/mumps -run ^GDE < /opt/agility/gde.txt \
  && /usr/local/lib/yottadb/r206/mupip create \
  && /usr/local/lib/yottadb/r206/mupip extend -blocks=48000 DEFAULT

# Install and configure the network mgsi interface code to allow
# network access to YottaDB (default setup uses
# API access to YottaDB)

RUN git clone https://github.com/chrisemunt/mgsi /opt/agility/mgsi \
  && cp /opt/agility/mgsi/yottadb/* /opt/agility/m \
  && /opt/agility/ydb_run_temp ylink^%zmgsi \
  && cp /opt/agility/mgsi/unix/zmgsi.ci /usr/local/lib/yottadb/r206

RUN cp /opt/agility/mgsi/unix/zmgsi_ydb /usr/local/lib/yottadb/r206 \
  && cp /opt/agility/mgsi/unix/zmgsi_xinetd /etc/xinetd.d/zmgsi_xinetd \
  && cp /opt/agility/mgsi/unix/zmgsi.ci /usr/local/lib/yottadb/r206 \
  && sed -i 's/130/206/g' /etc/xinetd.d/zmgsi_xinetd \
  && sed -i 's/130/206/g' /usr/local/lib/yottadb/r206/zmgsi_ydb \
  && sed -i 's/1.30/2.06/g' /usr/local/lib/yottadb/r206/zmgsi_ydb \
  && echo "zmgsi_xinetd          7041/tcp                        # zmgsi" >> /etc/services \
  && rm -r /opt/agility/mgsi

# Clean up

RUN cd /opt/agility \
  && rm gde.txt \
  && rm ydb_run_temp \
  && rm -r /opt/nginx-1.30.4/ \
  && rm /opt/nginx-1.30.4.tar.gz

RUN updatedb

EXPOSE 8080

ENTRYPOINT ./start && bash
