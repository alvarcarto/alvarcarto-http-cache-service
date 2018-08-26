# alvarcarto-http-cache-service

Simple HTTP reverse proxy which caches GET requests to local disk forever. Just point it
to an origin and you have a cached origin.


# Install


**First:**

* Buy the cheapest SSD VPS from https://www.ovh-hosting.fi/ with external SSD disk (e.g. 100GB)
* Install the server


As root in the remote server, change root password and create `alvar` user:

```
# Change root password and save it to 1password
passwd

adduser alvar
adduser alvar sudo

# Change hostname
hostnamectl set-hostname <name>
```

You can save the server to your local .ssh config:
```
Host <name>
    Hostname <ip>
    User alvar
    AddKeysToAgent yes
    UseKeychain yes
    IdentityFile ~/.ssh/<name>.key
```

Start a new ssh session with `ssh alvar@<name>`.
```
cd
mkdir .ssh
nano .ssh/authorized_keys
# Copy paste the public key which we just generated and save file
```

In the remote server, first mount the external SSD disk:

```
# Find which device is the external 100GB disk
sudo fdisk -l

# If it was /dev/sdb, run:
sudo mkfs.ext4 /dev/sdb

sudo mkdir -p /cache
sudo chown alvar: /cache
# Mount now
sudo mount /dev/sdb /cache

# Mount on startup

# This should output:
# /dev/sdb: UUID="968c5217-df90-4e66-9a91-8d9874ace981" TYPE="ext4"
sudo blkid | grep "sdb"

sudo nano /etc/fstab
# Add line:
# UUID=968c5217-df90-4e66-9a91-8d9874ace981       /cache  ext4    auto,user,rw    0 0
```

Then run:

```
sudo apt-get install -y screen nano git

# Increase scrollback to 50k lines
echo "defscrollback 50000" >> ~/.screenrc
echo "deflog on" >> ~/.screenrc
echo "logfile /home/alvar/screenlog.%n" >> ~/.screenrc

git clone https://alvarcarto-integration:fab7f21687f2cea5dfb2971ea69821b5e5cb87a2@github.com/kimmobrunfeldt/alvarcarto-http-cache-service.git
cd alvarcarto-http-cache-service
```

Also disallow root SSH login:

```
sudo nano /etc/ssh/sshd_config
# And set PermitRootLogin no

# Restart
sudo service ssh restart
```

Add public cert and private key for Caddy:

```
sudo mkdir -p /etc/caddy

# Add cert from 1password (*.alvarcarto.com and apex cert by CloudFlare)
sudo nano /etc/caddy/cert.pem

# Add private key from 1password
sudo nano /etc/caddy/key.pem

sudo chown www-data:www-data /etc/caddy/cert.pem /etc/caddy/key.pem
sudo chmod 644 /etc/caddy/cert.pem
sudo chmod 600 /etc/caddy/key.pem
```

Run `sudo nano /etc/systemd/system/caddy.service` and uncomment the following lines:

```
; The following additional security directives only work with systemd v229 or later.
; They further retrict privileges that can be gained by caddy. Uncomment if you like.
; Note that you may have to add capabilities required by any plugins in use.
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
```

Then run:
```
sudo systemctl daemon-reload
sudo systemctl restart caddy

# see if all went ok: sudo cat /var/log/syslog
```

Then run:

```
screen -S install
./server/install.sh
```

Now the server should have all the components installed and node processes
running.

**Note:** sudo password may be asked a couple of times.

Now press `Ctrl` + `a` + `d` and wait.


## Testing installation

What you should test after the install:

* Run `sudo reboot` and see if node processes are automatically spawned on boot
* Verify that CloudFlare origin certificates have been correctly installed
