import {CHUNK_SIZE_X, CHUNK_SIZE_Y, CHUNK_SIZE_Z} from "../../chunk.js";
import {Color, Vector, VectorCollector, DIRECTION} from '../../helpers.js';
import {impl as alea} from '../../../vendors/alea.js';
import { AABB } from "../../core/AABB.js";

const SIZE_CLUSTER = 8;
const LANTERN_ROT_UP = {x: 0, y: -1, z: 0};
export const MINE_SIZE = new Vector(CHUNK_SIZE_X * SIZE_CLUSTER, 40, CHUNK_SIZE_Z * SIZE_CLUSTER);
export const NODE_SIZE = new Vector(CHUNK_SIZE_X, 4, CHUNK_SIZE_Z);
export const NODE_COUNT = new Vector(MINE_SIZE.x / NODE_SIZE.x, MINE_SIZE.y / NODE_SIZE.y, MINE_SIZE.z / NODE_SIZE.z);

/**
 * Draw mines
 * @class MineGenerator
 * @param {World} world world
 * @param {Vector} pos chunk positon
 * @param {object} options options
 */
export class MineGenerator {

    static all = new VectorCollector();

    constructor(generator, addr, options = {}) {
        this.size_cluster = (options.size_cluster) ? options.size_cluster : 8;
        this.chance_hal = (options.chance_hal) ? options.chance_hal : 0.5;
        this.chance_cross = (options.chance_cross) ? options.chance_cross : 0.2;
        this.chance_side_room = (options.chance_side_room) ? options.chance_side_room : 0.5;
        this.generator = generator;
        this.addr = addr.clone();
        this.coord = (new Vector(addr.x, addr.y, addr.z)).multiplyVecSelf(MINE_SIZE);
        this._get_vec = new Vector(0, 0, 0);
        this.random = new alea(this.x + "mine" + this.y + "mine" + this.z);
        for (let i = 0; i < 1000; ++i) {
            this.nodes = new VectorCollector();
            const bottom_y = Math.floor(this.random.double() * (NODE_COUNT.y - 2));
            this.genNodeMine(0, bottom_y, 0, DIRECTION.SOUTH);
            if (this.nodes.size > this.size_cluster) {
                break;
            }
        }
        
        console.log("[INFO]MineGenerator: generation " + this.nodes.size + " nodes");
        
        this.voxel_buildings = [];
    }

    // getForCoord
    static getForCoord(generator, coord) {
        const addr = new Vector(coord.x, 0, coord.z).divScalarVec(MINE_SIZE).flooredSelf();
        let mine = MineGenerator.all.get(addr);
        if(mine) {
            return mine;
        }
        let options = {
            'chance_hal' : 0.4
        };
        mine = new MineGenerator(generator, addr, options);
        MineGenerator.all.set(addr, mine);
        return mine;
    }

    // generate node
    genNodeMine(x, y, z, dir) {

        if (x > NODE_COUNT.x || x < 0 || y > NODE_COUNT.y || y < 0 || z > NODE_COUNT.z || z < 0) {
            return;
        }

        let new_x = x, new_y = y, new_z = z;
        
        if (dir == DIRECTION.SOUTH) {
            ++new_z;
        } else if (dir == DIRECTION.EAST) {
            ++new_x;
        } else if (dir == DIRECTION.NORTH) {
            --new_z;
        } else if (dir == DIRECTION.WEST){
            --new_x;
        }

        if (this.nodes.size == 0) {
            this.addNode(x, y, z, dir, 'enter');
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.WEST, dir));
            //
            y++;
            this.addNode(x, y, z, dir, 'cross');
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(x, y, z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }
        
        let node = this.findNodeMine(new_x, new_y, new_z);
        if (node != null) {
            return;
        }

        if (this.random.double() < this.chance_cross) {
            this.addNode(new_x, new_y, new_z, dir, 'cross');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.EAST, dir));
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.WEST, dir));
            return;
        }
        
        if (this.random.double() < this.chance_hal) {
            this.addNode(new_x, new_y, new_z, dir, 'hal');
            this.genNodeMine(new_x, new_y, new_z, this.wrapRotation(DIRECTION.NORTH, dir));
            return;
        }
        
        if (this.random.double() < this.chance_side_room) {
            this.addNode(new_x, new_y, new_z, dir, 'room');
        }

    }

    // Generate chunk blocks
    fillBlocks(chunk) {

        let aabb = new AABB();

        aabb.x_min = (chunk.coord.x - this.coord.x) / NODE_SIZE.x;
        aabb.z_min = (chunk.coord.z - this.coord.z) / NODE_SIZE.z;
        aabb.x_max = aabb.x_min;
        aabb.z_max = aabb.z_min;
        aabb.y_max = NODE_COUNT.y;

        for(let [_, node] of this.nodes.entries(aabb)) {
            if (node.type == "enter") {
                this.genNodeEnter(chunk, node);
            } else if (node.type == "cross") {
                this.genNodeCross(chunk, node);
            } else if (node.type == "hal") {
                this.genNodeHal(chunk, node);
            } else if (node.type == "room") {
                this.genNodeSideRoom(chunk, node);
            }
        }

    }

    // Generate sideroom node
    genNodeSideRoom(chunk, node) {
        const dir = node.dir;
        this.genBox(chunk, node, 0, 0, 0, 9, 1, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, node, 0, 2, 0, 9, 3, 4, dir, BLOCK.BRICK);
        this.genBox(chunk, node, 1, 1, 1, 8, 3, 4, dir);
        
        let vec = new Vector(0, 0, 0);
        vec.set(8, 3, 4).rotY(dir); 
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.LANTERN, true, LANTERN_ROT_UP);
        
        vec.set(1, 1, 1).rotY(dir); 
        this.setBlock(chunk, node, vec.x, vec.y, vec.z, BLOCK.CHEST, true, LANTERN_ROT_UP);
    }

    // Generate enter node
    genNodeEnter(chunk, node) {
        const dir = node.dir;
        this.genBox(chunk, node, 0, 1, 8, 15, 3, 15, dir);
        this.genBox(chunk, node, 0, 0, 0, 15, 0, 15, dir, BLOCK.OAK_PLATE);

        const addFloorDecor = (vec, block) => {
            let temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
            // block must connected to other block (not air) 
            if(temp_block_over && temp_block_over.id != 0) {
                this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true, LANTERN_ROT_UP);
            }
        };

        let vec = new Vector(0, 0, 0);
        addFloorDecor(vec.set(15, 3, 15).rotY(dir), BLOCK.LANTERN);
        addFloorDecor(vec.set(0, 3, 15).rotY(dir), BLOCK.LANTERN);
        addFloorDecor(vec.set(0, 3, 8).rotY(dir), BLOCK.LANTERN);
        addFloorDecor(vec.set(15, 3, 8).rotY(dir), BLOCK.LANTERN);

    }

    // Generate cross node
    genNodeCross(chunk, node) {
        const dir = node.dir;
        this.genBox(chunk, node, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);
        
        this.genBox(chunk, node, 0, 1, 1, 1, 3, 3, dir);
        this.genBox(chunk, node, 1, 1, 0, 3, 3, 15, dir);
        this.genBox(chunk, node, 1, 1, 12, 15, 3, 14, dir);
        
        // floor as bridge over air
        this.genBox(chunk, node, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLATE, 1, true);
        this.genBox(chunk, node, 1, 0, 12, 15, 0, 14, dir, BLOCK.OAK_PLATE, 1, true);
        this.genBox(chunk, node, 0, 0, 1, 1, 0, 3, dir, BLOCK.OAK_PLATE, 1, true);
        
        let interval = Math.round(node.random.double()) + 4;

        for (let n = 0; n < 16; n += interval) {
            // опоры
            this.genBox(chunk, node, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            
            this.genBox(chunk, node, n, 1, 14, n, 2, 14, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, n, 1, 12, n, 2, 12, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, n, 3, 12, n, 3, 14, dir, BLOCK.OAK_SLAB);
            
            // паутина
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            
            this.genBoxAir(chunk, node, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.COBWEB, 0.05);
            
            // факелы
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, 0.2, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.1, LANTERN_ROT_UP);
            
            this.genBoxAir(chunk, node, n - 3, 3, 14, n + 3, 3, 14, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, n - 3, 3, 12, n + 3, 3, 12, dir, BLOCK.LANTERN, 0.2, LANTERN_ROT_UP);
        }
    }

    // Generate hal node
    genNodeHal(chunk, node) {
        const dir = node.dir;

        this.genBox(chunk, node, 0, 1, 0, 4, 4, 15, dir, BLOCK.AIR, 0.05);
        this.genBox(chunk, node, 1, 1, 0, 3, 3, 15, dir);

        // floor
        this.genBox(chunk, node, 1, 0, 0, 3, 0, 15, dir, BLOCK.OAK_PLANK, 1, true);
        
        let interval = Math.round(node.random.double()) + 4;
        for (let n = 0; n <= 15; n += interval) {
            this.genBox(chunk, node, 1, 1, n, 1, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 3, 1, n, 3, 2, n, dir, BLOCK.OAK_FENCE);
            this.genBox(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB);
            
            this.genBoxNoAir(chunk, node, 1, 3, n, 3, 3, n, dir, BLOCK.OAK_SLAB, 0.25);
            
            this.genBoxAir(chunk, node, 1, 3, n - 1, 1, 3, n + 1, dir, BLOCK.COBBLESTONE, 0.25); // добавить из окружения
            this.genBoxAir(chunk, node, 3, 3, n - 1, 3, 3, n + 1, dir, BLOCK.DIRT, 0.25);
            
            // паутина
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.COBWEB, 0.05);
            
            // грибы
            this.genBoxAir(chunk, node, 1, 1, n - 3, 1, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);
            this.genBoxAir(chunk, node, 3, 1, n - 3, 3, 1, n + 3, dir, BLOCK.BROWN_MUSHROOM, 0.01);
            
            // факел
            this.genBoxAir(chunk, node, 3, 3, n - 3, 3, 3, n + 3, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
            this.genBoxAir(chunk, node, 1, 3, n - 3, 1, 3, n + 3, dir, BLOCK.LANTERN, 0.1, LANTERN_ROT_UP);
        }
    }

    // Add new node
    addNode(x, y, z, dir, type) {
        const bottom_y = y * NODE_SIZE.y;
        const random = new alea(`node_mine_${x}_${y}_${z}`);
        this.nodes.set(new Vector(x, y, z), {dir, type, random, bottom_y});
    }

    findNodeMine(x, y, z) {
        return this.nodes.get(this._get_vec.set(x, y, z)) || null;
    }

    setBlock(chunk, node, x, y, z, block_type, force_replace, rotate, extra_data) {
        y += node.bottom_y;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            this.xyz_temp = new Vector(0, 0, 0);
            this.xyz_temp.set(x, y, z);
            if(force_replace || !chunk.tblocks.has(this.xyz_temp)) {
                this.xyz_temp_coord = new Vector(x + chunk.coord.x, y + chunk.coord.y, z + chunk.coord.z);
                if(!this.generator.getVoxelBuilding(this.xyz_temp_coord)) {
                    let index = (CHUNK_SIZE_X * CHUNK_SIZE_Z) * this.xyz_temp.y + (this.xyz_temp.z * CHUNK_SIZE_X) + this.xyz_temp.x;
                    chunk.tblocks.id[index] = block_type.id;
                    if(rotate || extra_data) {
                        this.temp_tblock = chunk.tblocks.get(this.xyz_temp, this.temp_tblock);
                        if(rotate) this.temp_tblock.rotate = rotate;
                        if(extra_data) this.temp_tblock.extra_data = extra_data;
                    }
                    // chunk.tblocks.delete(this.xyz_temp);
                    // this.temp_tblock = chunk.tblocks.get(this.xyz_temp, this.temp_tblock);
                    // this.temp_tblock.id = block_type.id;
                }
            }
        }
    }
    
    getBlock(chunk, node, x, y, z) {
        y += node.bottom_y;
        if(x >= 0 && x < chunk.size.x && z >= 0 && z < chunk.size.z && y >= 0 && y < chunk.size.y) {
            let xyz = new Vector(x, y, z);
            return chunk.tblocks.get(xyz);
        }
    }
    
    wrapRotation(dir, angle) {
        let new_dir = dir - angle;
        if (new_dir == -1) {
            new_dir = 3;
        } else if (new_dir == -2) {
            new_dir = 2;
        }
        return new_dir;
    }
    
    /**
     * TO DO EN генерация бокса внутри чанка, генерация с вероятностью установки
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность установки
     */
    genBox(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION.NORTH, blocks = {id : 0}, chance = 1, only_if_air = false) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let is_chance = (chance == 1) ? true : node.random.double() < chance; 
                    if (is_chance) {
                        let vec = (new Vector(x, y, z)).rotY(dir);
                        if(only_if_air) {
                            let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                            if(temp_block.id != 0) {
                                continue;
                            }
                        }
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, blocks, true); 
                    }
                }
            }
        }
    }

    /**
     * TO DO EN замена воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     * @param {Vector} block_rotate поворот блока
     */
    genBoxAir(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1, block_rotate = null) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    let temp_block_over = this.getBlock(chunk, node, vec.x, vec.y + 1, vec.z);
                    // block must connected to other block (not air) 
                    if(temp_block_over && temp_block_over.id != 0) {
                        let is_chance = (chance == 1) ?  true : node.random.double() < chance;
                        if (is_chance == true && temp_block != null && temp_block.id == 0) {
                            this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true, block_rotate); 
                        }
                    }
                }
            }
        }
    }
    
    /**
     * TO DO EN замена не воздуха на блок с вероятностью
     * @param {Chunk} chunk
     * @param {number} minX
     * @param {number} minY
     * @param {number} minZ
     * @param {number} maxX
     * @param {number} maxY
     * @param {number} maxZ
     * @param {Block} block
     * @param {DIRECTION} dir поворот внутри чанка
     * @param {float} chance вероятность замены
     */
    genBoxNoAir(chunk, node, minX, minY, minZ, maxX, maxY, maxZ, dir = DIRECTION_BIT.NORTH, block = {id : 0}, chance = 1) {
        for (let x = minX; x <= maxX; ++x) {
            for (let y = minY; y <= maxY; ++y) {
                for (let z = minZ; z <= maxZ; ++z) {
                    let vec = (new Vector(x, y, z)).rotY(dir);
                    let temp_block = this.getBlock(chunk, node, vec.x, vec.y, vec.z);
                    let is_chance = (chance == 1) ?  true : node.random.double() < chance;
                    if (is_chance == true && temp_block != null && temp_block.id != 0) {
                        this.setBlock(chunk, node, vec.x, vec.y, vec.z, block, true); 
                    }
                }
            }
        }
    }

}