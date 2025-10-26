# Darwin (macOS) Utility Commands

## File Operations
```bash
# List files with details
ls -la

# Find files by name
find . -name "*.ts" -type f

# Search in files (use ripgrep if available, otherwise grep)
grep -r "search_term" src/
rg "search_term" src/  # if ripgrep installed

# Copy files/directories
cp source.txt destination.txt
cp -r source_dir destination_dir

# Remove files/directories
rm file.txt
rm -rf directory

# Create directories
mkdir -p path/to/directory
```

## Process Management
```bash
# View running processes
ps aux | grep node

# Kill process by PID
kill -9 <PID>

# Kill process by name
pkill -f "node"
```

## Network & Services
```bash
# Check port usage
lsof -i :3000
netstat -an | grep 3000

# Check Docker containers
docker ps
docker-compose ps

# View Docker logs
docker logs <container_id>
docker-compose logs -f
```

## Git Operations
```bash
# Check status
git status

# View changes
git diff
git diff --staged

# Stage and commit
git add .
git commit -m "message"

# Branch operations
git branch
git checkout -b feature-branch
git merge main
```

## System Information
```bash
# Check Node.js version
node --version

# Check pnpm version
pnpm --version

# Check system info
uname -a
sw_vers  # macOS version

# Check disk space
df -h

# Check memory usage
top -l 1 | grep PhysMem
```